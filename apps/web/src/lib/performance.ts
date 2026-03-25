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
  unrealizedPnl: string;
};

export type OpenRoundMemberLike = {
  commitAmount: string;
  orderPrice: string | null;
  predictionRound: {
    createdAt: string;
    clubId: string;
    status: string;
    targetTokenId: string;
    outcome: string | null;
    targetOutcome: string;
  };
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
      unrealizedPnl: '0',
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
    unrealizedPnl: '0',
  };
}

/**
 * Compute the effective current price for an open position.
 * - COMMITTED: use live midpoint from Polymarket CLOB.
 * - RESOLVED: use 1.0 (win) or 0.0 (loss) based on outcome vs target.
 */
function getEffectivePrice(
  member: OpenRoundMemberLike,
  prices: Map<string, string>
): number | null {
  const { status, outcome, targetOutcome, targetTokenId } = member.predictionRound;

  if (status === 'RESOLVED' && outcome != null) {
    return outcome.trim().toLowerCase() === targetOutcome.trim().toLowerCase() ? 1.0 : 0.0;
  }

  const midpoint = prices.get(targetTokenId);
  if (midpoint == null) return null;
  const parsed = Number(midpoint);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Compute performance from prediction round members (payouts vs commits) within window.
 * Optionally includes unrealized P&L from open (COMMITTED/RESOLVED) positions.
 */
export function computeClubPerformanceFromRounds(
  members: RoundMemberLike[],
  days = 30,
  now = new Date(),
  openPositions?: {
    members: OpenRoundMemberLike[];
    prices: Map<string, string>;
  }
): ClubPerformance {
  const empty: ClubPerformance = {
    days,
    navStart: '0',
    navEnd: '0',
    netFlows: '0',
    simpleReturn: 0,
    hasWindowActivity: false,
    realizedPnl: '0',
    unrealizedPnl: '0',
  };

  const hasSettled = members && members.length > 0;
  const hasOpen = openPositions && openPositions.members.length > 0;

  if (!hasSettled && !hasOpen) return empty;

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  let commitTotal = 0n;
  let payoutTotal = 0n;
  let windowActivity = 0;

  // Realized P&L from settled rounds
  if (hasSettled) {
    for (const m of members) {
      const ts = new Date(m.predictionRound.createdAt);
      if (ts < cutoff) continue;
      windowActivity += 1;
      commitTotal += BigInt(m.commitAmount);
      payoutTotal += BigInt(m.payoutAmount);
    }
  }

  // Unrealized P&L from open positions
  let unrealizedPnlFloat = 0;
  let openCommitTotal = 0n;

  if (hasOpen) {
    for (const m of openPositions.members) {
      const ts = new Date(m.predictionRound.createdAt);
      if (ts < cutoff) continue;

      const orderPrice = m.orderPrice != null ? Number(m.orderPrice) : 0;
      if (!orderPrice) continue;

      const currentPrice = getEffectivePrice(m, openPositions.prices);
      if (currentPrice == null) continue;

      const commit = BigInt(m.commitAmount);
      openCommitTotal += commit;
      windowActivity += 1;

      // unrealizedPnl = commitAmount * ((currentPrice - orderPrice) / orderPrice)
      unrealizedPnlFloat += Number(commit) * ((currentPrice - orderPrice) / orderPrice);
    }
  }

  if (windowActivity === 0) return empty;

  const realizedPnl = payoutTotal - commitTotal;
  const totalCommit = commitTotal + openCommitTotal;
  const totalPnlFloat = Number(realizedPnl) + unrealizedPnlFloat;
  const simpleReturn = totalCommit === 0n ? 0 : totalPnlFloat / Number(totalCommit);

  return {
    days,
    navStart: '0',
    navEnd: '0',
    netFlows: '0',
    simpleReturn,
    hasWindowActivity: true,
    realizedPnl: realizedPnl.toString(),
    unrealizedPnl: Math.round(unrealizedPnlFloat).toString(),
  };
}
