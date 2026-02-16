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
    const members = await prisma.predictionRoundMember.findMany({
      where: { predictionRoundId: roundId },
      select: roundMemberSelect,
    });

    if (members.length === 0) {
      return [];
    }

    const round = await prisma.predictionRound.findUnique({
      where: { id: roundId },
      select: { clubId: true },
    });
    if (!round) {
      return [];
    }

    const userIds = members.map((member) => member.userId);
    const clubWallets = await prisma.clubWallet.findMany({
      where: {
        clubId: round.clubId,
        userId: { in: userIds },
      },
      select: {
        id: true,
        userId: true,
        turnkeyWalletAddress: true,
        polymarketSafeAddress: true,
        polymarketApiKeyId: true,
        polymarketApiSecret: true,
        polymarketApiPassphrase: true,
        provisioningStatus: true,
        isDisabled: true,
        turnkeyWalletAccountId: true,
        turnkeyDelegatedUserId: true,
        turnkeyPolicyId: true,
      },
    });
    const walletByUserId = new Map(clubWallets.map((wallet) => [wallet.userId, wallet]));

    return members.map((member) => ({
      ...member,
      clubWallet: walletByUserId.get(member.userId) ?? null,
    }));
  }

  static async markRoundCommitted(roundId: string) {
    await prisma.predictionRound.update({
      where: { id: roundId },
      data: { status: 'COMMITTED' },
    });
  }

  static async markRoundCancelled(roundId: string) {
    await prisma.predictionRound.update({
      where: { id: roundId },
      data: { status: 'CANCELLED' },
    });
  }

  static async cancelRoundAndRevertCommits(roundId: string, reason: string) {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const commits = await tx.ledgerEntry.findMany({
        where: {
          predictionRoundId: roundId,
          type: 'COMMIT',
        },
        select: {
          id: true,
          safeAddress: true,
          clubWalletId: true,
          clubId: true,
          userId: true,
          amount: true,
          asset: true,
        },
      });

      const existingReversals = await tx.ledgerEntry.findMany({
        where: {
          predictionRoundId: roundId,
          type: 'ADJUSTMENT',
        },
        select: {
          userId: true,
          amount: true,
          metadata: true,
        },
      });

      const reversalKeys = new Set(
        existingReversals
          .filter((entry) => {
            if (!entry.metadata || typeof entry.metadata !== 'object') return false;
            return (
              (entry.metadata as Record<string, unknown>).source ===
              'prediction-round-cancelled-reversal'
            );
          })
          .map((entry) => `${entry.userId}:${entry.amount}`)
      );

      const reversals = commits.flatMap((entry) => {
        const absolute = (() => {
          const value = BigInt(entry.amount);
          return (value < 0n ? -value : value).toString();
        })();
        const key = `${entry.userId}:${absolute}`;
        if (reversalKeys.has(key)) return [];

        return [
          {
            safeAddress: entry.safeAddress,
            clubWalletId: entry.clubWalletId,
            clubId: entry.clubId,
            userId: entry.userId,
            predictionRoundId: roundId,
            type: 'ADJUSTMENT' as LedgerEntryType,
            amount: absolute,
            asset: entry.asset,
            metadata: {
              source: 'prediction-round-cancelled-reversal',
              reason,
            } satisfies Prisma.InputJsonValue,
            createdAt: now,
          },
        ];
      });

      if (reversals.length > 0) {
        await tx.ledgerEntry.createMany({ data: reversals });
      }

      await tx.predictionRound.update({
        where: { id: roundId },
        data: { status: 'CANCELLED' },
      });
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
        clubWalletId?: string | null;
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
          const safeAddress = member.clubWallet?.polymarketSafeAddress;
          if (!safeAddress) {
            throw new Error(`Missing club wallet for user ${member.userId}`);
          }
          const clubWalletId = member.clubWallet?.id;
          ledgerEntries.push({
            safeAddress,
            clubWalletId,
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

  static async syncSettledRoundPayouts(
    round: PendingRound,
    members: RoundMember[],
    payouts: MemberPayout[]
  ): Promise<{ updatedMembers: number; createdPayoutEntries: number }> {
    const payoutByUser = new Map(payouts.map((payout) => [payout.userId, payout]));
    const missing = members.filter((member) => !payoutByUser.has(member.userId));
    if (missing.length > 0) {
      throw new Error(`Missing payouts for ${missing.length} members.`);
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
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
        clubWalletId?: string | null;
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

      let updatedMembers = 0;
      for (const member of members) {
        const payout = payoutByUser.get(member.userId);
        if (!payout) continue;

        const payoutAmount = payout.payoutAmount;
        const pnlAmount =
          payout.pnlAmount ?? (BigInt(payoutAmount) - BigInt(member.commitAmount)).toString();

        if (!existingPayoutUsers.has(member.userId) && BigInt(payoutAmount) > 0n) {
          const safeAddress = member.clubWallet?.polymarketSafeAddress;
          if (!safeAddress) {
            throw new Error(`Missing club wallet for user ${member.userId}`);
          }
          const clubWalletId = member.clubWallet?.id;
          ledgerEntries.push({
            safeAddress,
            clubWalletId,
            clubId: round.clubId,
            userId: member.userId,
            predictionRoundId: round.id,
            type: 'PAYOUT',
            amount: payoutAmount,
            asset: 'USDC.e',
            metadata: { source: 'polymarket-payout-backfill' } as Prisma.InputJsonValue,
            createdAt: now,
          });
        }

        const payoutChanged = member.payoutAmount !== payoutAmount;
        const pnlChanged = member.pnlAmount !== pnlAmount;
        if (!payoutChanged && !pnlChanged) continue;

        await tx.predictionRoundMember.update({
          where: { id: member.id },
          data: {
            payoutAmount,
            pnlAmount,
            settledAt: member.settledAt ?? now,
          },
        });
        updatedMembers += 1;
      }

      if (ledgerEntries.length > 0) {
        await tx.ledgerEntry.createMany({ data: ledgerEntries });
      }

      return { updatedMembers, createdPayoutEntries: ledgerEntries.length };
    });
  }
}
