import { prisma } from '@prediction-club/db';
import type { Prisma } from '@prediction-club/db';
import { sumLedgerAmounts } from '@prediction-club/shared';

export class LedgerController {
  static async createEntries(
    entries: Prisma.LedgerEntryCreateManyInput[],
    tx: Prisma.TransactionClient = prisma
  ) {
    if (entries.length === 0) return;
    await tx.ledgerEntry.createMany({ data: entries });
  }

  static async recordDeposit(input: {
    safeAddress: string;
    clubId: string;
    userId: string;
    amount: string;
    asset?: string;
    txHash?: string | null;
    metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const { safeAddress, clubId, userId, amount, asset = 'USDC.e', txHash, metadata } = input;
    await prisma.ledgerEntry.create({
      data: {
        safeAddress,
        clubId,
        userId,
        type: 'DEPOSIT',
        amount,
        asset,
        txHash,
        metadata,
      },
    });
  }

  static async getUserLedgerHistory(input: { userId: string; clubId?: string }) {
    const { userId, clubId } = input;
    return prisma.ledgerEntry.findMany({
      where: {
        userId,
        ...(clubId ? { clubId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        predictionRound: true,
        club: true,
      },
    });
  }

  static async getClubLedgerHistory(input: { clubId: string }) {
    return prisma.ledgerEntry.findMany({
      where: { clubId: input.clubId },
      orderBy: { createdAt: 'desc' },
      include: {
        predictionRound: true,
        club: true,
      },
    });
  }

  static async getUserClubBalance(input: { userId: string; clubId: string }) {
    const { userId, clubId } = input;
    const entries = await prisma.ledgerEntry.findMany({
      where: { userId, clubId },
      select: { amount: true },
    });
    return sumLedgerAmounts(entries);
  }

  static async getUserNetBalance(input: { userId: string }) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { userId: input.userId },
      select: { amount: true },
    });
    return sumLedgerAmounts(entries);
  }

  static async getClubActiveCommitVolume(input: { clubId: string }) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        clubId: input.clubId,
        type: 'COMMIT',
        predictionRound: {
          status: { in: ['PENDING', 'COMMITTED'] },
        },
      },
      select: { amount: true },
    });
    const total = entries.reduce((sum, entry) => {
      const value = BigInt(entry.amount);
      return sum + (value < 0n ? -value : value);
    }, 0n);
    return total.toString();
  }

  static async getClubsActiveCommitVolume(input: { clubIds: string[] }) {
    if (input.clubIds.length === 0) return new Map<string, string>();
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        clubId: { in: input.clubIds },
        type: 'COMMIT',
        predictionRound: {
          status: { in: ['PENDING', 'COMMITTED'] },
        },
      },
      select: { clubId: true, amount: true },
    });
    const totals = new Map<string, bigint>();
    for (const entry of entries) {
      const value = BigInt(entry.amount);
      const next = (totals.get(entry.clubId) ?? 0n) + (value < 0n ? -value : value);
      totals.set(entry.clubId, next);
    }
    return new Map<string, string>(
      Array.from(totals.entries()).map(([clubId, total]) => [clubId, total.toString()])
    );
  }

  static async getClubsAllTimeCommitVolume(input: { clubIds: string[] }) {
    if (input.clubIds.length === 0) return new Map<string, string>();
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        clubId: { in: input.clubIds },
        type: 'COMMIT',
      },
      select: { clubId: true, amount: true },
    });
    const totals = new Map<string, bigint>();
    for (const entry of entries) {
      const value = BigInt(entry.amount);
      const next = (totals.get(entry.clubId) ?? 0n) + (value < 0n ? -value : value);
      totals.set(entry.clubId, next);
    }
    return new Map<string, string>(
      Array.from(totals.entries()).map(([clubId, total]) => [clubId, total.toString()])
    );
  }
}

export class LedgerError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}
