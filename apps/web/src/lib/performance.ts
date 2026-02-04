import type { LedgerEntryType } from '@prisma/client';

export type LedgerEntryLike = {
  type: LedgerEntryType | string;
  amount: string;
  createdAt: string;
};

export type RoundMemberLike = {
  commitAmount: string;
  payoutAmount: string;
  pnlAmount: string;
  predictionRound: {
    createdAt: string;
    clubId: string;
    status: string;
  };
};

export type ClubPerformance = {
  days: number;
  navStart: string;
  navEnd: string;
  netFlows: string;
  simpleReturn: number; // decimal, e.g., 0.12 = 12%
  hasWindowActivity: boolean;
  realizedPnl: string;
};

type ExposureState = {
  wallet: bigint;
  market: bigint;
};

function applyLedger(entry: LedgerEntryLike, state: ExposureState) {
  const amt = BigInt(entry.amount);
  switch (entry.type) {
    case 'DEPOSIT':
    case 'ADJUSTMENT':
      state.wallet += amt;
      break;
    case 'WITHDRAW':
      state.wallet += amt; // expected negative if withdrawing
      break;
    case 'COMMIT': {
      const delta = amt < 0n ? -amt : amt;
      state.wallet -= delta;
      state.market += delta;
      break;
    }
    case 'PAYOUT': {
      const delta = amt < 0n ? -amt : amt;
      state.market = state.market > delta ? state.market - delta : 0n;
      state.wallet += delta;
      break;
    }
    default:
      state.wallet += amt;
  }
}

export function computeClubPerformance(
  entries: LedgerEntryLike[],
  days = 30,
  now = new Date()
): ClubPerformance {
  if (!entries || entries.length === 0) {
    return {
      days,
      navStart: '0',
      navEnd: '0',
      netFlows: '0',
      simpleReturn: 0,
      hasWindowActivity: false,
      realizedPnl: '0',
    };
  }

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const state: ExposureState = { wallet: 0n, market: 0n };
  let navStartCaptured = false;
  let navStart = 0n;
  let netFlows = 0n;
  let windowActivity = 0;
  let windowCommitAbs = 0n;
  let windowPayouts = 0n;

  for (const entry of sorted) {
    const ts = new Date(entry.createdAt);
    if (!navStartCaptured && ts >= cutoff) {
      navStart = state.wallet + state.market;
      navStartCaptured = true;
    }

    applyLedger(entry, state);

    if (ts >= cutoff) {
      windowActivity += 1;
      if (entry.type === 'COMMIT') {
        const delta = BigInt(entry.amount);
        windowCommitAbs += delta < 0n ? -delta : delta;
      }
      if (entry.type === 'PAYOUT') {
        const delta = BigInt(entry.amount);
        windowPayouts += delta < 0n ? -delta : delta;
      }
      if (entry.type === 'DEPOSIT' || entry.type === 'ADJUSTMENT') {
        netFlows += BigInt(entry.amount);
      }
      if (entry.type === 'WITHDRAW') {
        netFlows += BigInt(entry.amount); // negative if stored that way
      }
    }
  }

  if (!navStartCaptured) {
    navStart = state.wallet + state.market; // if no entries after cutoff
  }

  const navEnd = state.wallet + state.market;

  const numerator = navEnd - navStart - netFlows;
  let simpleReturn: number;
  if (navStart !== 0n) {
    simpleReturn = Number(numerator) / Number(navStart);
  } else if (windowCommitAbs !== 0n) {
    const realizedPnl = windowPayouts - windowCommitAbs;
    simpleReturn = Number(realizedPnl) / Number(windowCommitAbs);
  } else {
    simpleReturn = 0;
  }
  const realizedPnl = (windowPayouts - windowCommitAbs).toString();

  return {
    days,
    navStart: navStart.toString(),
    navEnd: navEnd.toString(),
    netFlows: netFlows.toString(),
    simpleReturn,
    hasWindowActivity: windowActivity > 0,
    realizedPnl,
  };
}

/**
 * Compute performance from prediction round members (payouts vs commits) within window.
 */
export function computeClubPerformanceFromRounds(
  members: RoundMemberLike[],
  days = 30,
  now = new Date()
): ClubPerformance {
  if (!members || members.length === 0) {
    return {
      days,
      navStart: '0',
      navEnd: '0',
      netFlows: '0',
      simpleReturn: 0,
      hasWindowActivity: false,
      realizedPnl: '0',
    };
  }

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  let commitTotal = 0n;
  let payoutTotal = 0n;
  let windowActivity = 0;

  for (const m of members) {
    const ts = new Date(m.predictionRound.createdAt);
    if (ts < cutoff) continue;
    windowActivity += 1;
    commitTotal += BigInt(m.commitAmount);
    payoutTotal += BigInt(m.payoutAmount);
  }

  if (windowActivity === 0) {
    return {
      days,
      navStart: '0',
      navEnd: '0',
      netFlows: '0',
      simpleReturn: 0,
      hasWindowActivity: false,
      realizedPnl: '0',
    };
  }

  const pnl = payoutTotal - commitTotal;
  const simpleReturn = commitTotal === 0n ? 0 : Number(pnl) / Number(commitTotal);

  return {
    days,
    navStart: '0',
    navEnd: '0',
    netFlows: '0',
    simpleReturn,
    hasWindowActivity: true,
    realizedPnl: pnl.toString(),
  };
}
