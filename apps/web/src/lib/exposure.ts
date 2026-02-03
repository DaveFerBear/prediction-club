import { format } from 'date-fns';
import type { LedgerEntryType } from '@prisma/client';

export type LedgerEntryLike = {
  type: LedgerEntryType | string;
  amount: string;
  createdAt: string;
};

export type ExposurePoint = {
  label: string;
  wallet: number;
  market: number;
};

// Compute stacked exposure (wallet vs in-market) over time from ledger entries.
export function buildExposureSeries(entries: LedgerEntryLike[]): ExposurePoint[] {
  if (!entries || entries.length === 0) return [];
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let wallet = 0n;
  let market = 0n;
  const points: ExposurePoint[] = [];

  for (const entry of sorted) {
    const amt = BigInt(entry.amount);
    const type = entry.type;

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

    const label = format(new Date(entry.createdAt), 'MMM d');
    const walletNum = Number(wallet) / 1_000_000;
    const marketNum = Number(market) / 1_000_000;
    points.push({
      label,
      wallet: Math.max(walletNum, 0),
      market: Math.max(marketNum, 0),
    });
  }

  return points;
}

