import { prisma, Prisma, type LedgerEntryType } from '@prediction-club/db';
import {
  pendingRoundSelect,
  roundMemberSelect,
  type PendingRound,
  type RoundMember,
  type MemberPayout,
  type MemberOrder,
  type MarketResolution,
} from '../types/chainworker-db';

export class ChainWorkerDBController {
  static async listRoundsToSettle(batchSize: number): Promise<PendingRound[]> {
    return prisma.predictionRound.findMany({
      where: {
        status: 'COMMITTED',
        settledAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: pendingRoundSelect,
    });
  }

  static async listRoundsToExecute(batchSize: number): Promise<PendingRound[]> {
    return prisma.predictionRound.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: pendingRoundSelect,
    });
  }

  static async getRoundMembers(roundId: string): Promise<RoundMember[]> {
    return prisma.predictionRoundMember.findMany({
      where: { predictionRoundId: roundId },
      select: roundMemberSelect,
    });
  }

  static async markRoundCommitted(roundId: string) {
    await prisma.predictionRound.update({
      where: { id: roundId },
      data: { status: 'COMMITTED' },
    });
  }

  static async updateMemberOrder(memberId: string, order: MemberOrder) {
    await prisma.predictionRoundMember.update({
      where: { id: memberId },
      data: {
        orderId: order.orderId,
        orderStatus: order.orderStatus ?? null,
        orderSide: order.orderSide ?? null,
        orderPrice: order.orderPrice ?? null,
        orderSize: order.orderSize ?? null,
        orderSizeMatched: order.orderSizeMatched ?? null,
        orderType: order.orderType ?? null,
        orderOutcome: order.orderOutcome ?? null,
        orderCreatedAt: order.orderCreatedAt ?? null,
        orderTxHashes: order.orderTxHashes ?? Prisma.JsonNull,
        orderMakingAmount: order.orderMakingAmount ?? null,
        orderTakingAmount: order.orderTakingAmount ?? null,
      },
    });
  }

  static async settleRound(
    round: PendingRound,
    members: RoundMember[],
    payouts: MemberPayout[],
    resolution: MarketResolution
  ) {
    const payoutByUser = new Map(payouts.map((payout) => [payout.userId, payout]));
    const missing = members.filter((member) => !payoutByUser.has(member.userId));
    if (missing.length > 0) {
      throw new Error(`Missing payouts for ${missing.length} members.`);
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const existingPayouts = await tx.ledgerEntry.findMany({
        where: {
          predictionRoundId: round.id,
          type: 'PAYOUT',
        },
        select: { userId: true },
      });
      const existingPayoutUsers = new Set(existingPayouts.map((entry) => entry.userId));

      const ledgerEntries: Array<{
        safeAddress: string;
        clubId: string;
        userId: string;
        predictionRoundId: string;
        type: LedgerEntryType;
        amount: string;
        asset: string;
        metadata?: Prisma.InputJsonValue;
        txHash?: string | null;
        createdAt?: Date;
      }> = [];

      const memberUpdates = members.map((member) => {
        const payout = payoutByUser.get(member.userId);
        if (!payout) return null;
        const payoutAmount = payout.payoutAmount;
        const pnlAmount =
          payout.pnlAmount ?? (BigInt(payoutAmount) - BigInt(member.commitAmount)).toString();

        if (!existingPayoutUsers.has(member.userId) && BigInt(payoutAmount) > 0n) {
          const safeAddress = member.user.polymarketSafeAddress;
          if (!safeAddress) {
            throw new Error(`Missing safe address for user ${member.userId}`);
          }
          ledgerEntries.push({
            safeAddress,
            clubId: round.clubId,
            userId: member.userId,
            predictionRoundId: round.id,
            type: 'PAYOUT',
            amount: payoutAmount,
            asset: 'USDC.e',
            metadata: { source: 'polymarket-settlement' } as Prisma.InputJsonValue,
            createdAt: now,
          });
        }

        if (member.settledAt) {
          return null;
        }

        return tx.predictionRoundMember.update({
          where: { id: member.id },
          data: {
            payoutAmount,
            pnlAmount,
            settledAt: now,
          },
        });
      });

      if (ledgerEntries.length > 0) {
        await tx.ledgerEntry.createMany({ data: ledgerEntries });
      }

      const updates = memberUpdates.filter(Boolean);
      if (updates.length > 0) {
        await Promise.all(updates);
      }

      await tx.predictionRound.update({
        where: { id: round.id },
        data: {
          status: 'SETTLED',
          outcome: resolution.outcome ?? null,
          resolvedAt: resolution.resolvedAt ?? now,
          settledAt: now,
        },
      });
    });
  }
}
