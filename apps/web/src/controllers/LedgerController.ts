import { prisma } from '@prediction-club/db';
import type { Prisma } from '@prediction-club/db';

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

  static async getUserClubBalance(input: { userId: string; clubId: string }) {
    const { userId, clubId } = input;
    const entries = await prisma.ledgerEntry.findMany({
      where: { userId, clubId },
      select: { amount: true },
    });
    const total = entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
    return total.toString();
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
