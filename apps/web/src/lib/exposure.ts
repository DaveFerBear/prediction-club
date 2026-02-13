import { addDays, endOfDay, format, startOfDay, subDays } from 'date-fns';
import type { LedgerEntryType } from '@prisma/client';

export type LedgerEntryLike = {
  type: LedgerEntryType | string;
  amount: string;
  createdAt: string;
};

export type ExposurePoint = {
  timestamp: number;
  label: string;
  wallet: number;
  market: number;
};

export const DEFAULT_EXPOSURE_WINDOW_DAYS = 7;

type ExposureState = {
  wallet: bigint;
  market: bigint;
};

function applyEntry(state: ExposureState, entry: LedgerEntryLike): ExposureState {
  const amt = BigInt(entry.amount);
  const type = entry.type;
  let { wallet, market } = state;

  switch (type) {
    case 'DEPOSIT':
    case 'ADJUSTMENT':
    case 'WITHDRAW':
      wallet += amt; // withdraw expected negative
      break;
    case 'COMMIT': {
      const delta = amt < 0n ? -amt : amt; // commits stored as negative
      wallet -= delta;
      market += delta;
      break;
    }
    case 'PAYOUT': {
      const delta = amt < 0n ? -amt : amt;
      market = market > delta ? market - delta : 0n;
      wallet += delta;
      break;
    }
    default:
      wallet += amt;
  }

  return { wallet, market };
}

function toExposurePoint(day: Date, state: ExposureState): ExposurePoint {
  const walletNum = Number(state.wallet) / 1_000_000;
  const marketNum = Number(state.market) / 1_000_000;
  return {
    timestamp: day.getTime(),
    label: format(day, 'MMM d'),
    wallet: Math.max(walletNum, 0),
    market: Math.max(marketNum, 0),
  };
}

// Compute stacked exposure over a fixed trailing N-day window using true calendar spacing.
export function buildExposureSeries(
  entries: LedgerEntryLike[],
  windowDays: number = DEFAULT_EXPOSURE_WINDOW_DAYS
): ExposurePoint[] {
  if (!entries || entries.length === 0) return [];
  const sorted = [...entries]
    .map((entry) => ({ ...entry, date: new Date(entry.createdAt) }))
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return [];

  const normalizedWindowDays = Number.isFinite(windowDays)
    ? Math.max(1, Math.floor(windowDays))
    : DEFAULT_EXPOSURE_WINDOW_DAYS;

  const today = startOfDay(new Date());
  const windowStart = subDays(today, normalizedWindowDays - 1);
  const windowEnd = endOfDay(today);

  let state: ExposureState = { wallet: 0n, market: 0n };
  let entryIndex = 0;

  // Build baseline from all historical entries before the trailing window.
  while (entryIndex < sorted.length && sorted[entryIndex].date < windowStart) {
    state = applyEntry(state, sorted[entryIndex]);
    entryIndex += 1;
  }

  const points: ExposurePoint[] = [];
  for (let dayOffset = 0; dayOffset < normalizedWindowDays; dayOffset += 1) {
    const day = addDays(windowStart, dayOffset);
    const dayEnd = endOfDay(day);
    const effectiveDayEnd = dayEnd > windowEnd ? windowEnd : dayEnd;

    while (entryIndex < sorted.length && sorted[entryIndex].date <= effectiveDayEnd) {
      state = applyEntry(state, sorted[entryIndex]);
      entryIndex += 1;
    }

    points.push(toExposurePoint(day, state));
  }

  return points;
}
