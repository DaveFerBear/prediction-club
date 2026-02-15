import { prisma } from '@prediction-club/db';
import { ClubController, ClubError } from './ClubController';
import { ClubWalletController, ClubWalletError } from './ClubWalletController';
import { LedgerController, LedgerError } from './LedgerController';

export interface CreatePredictionRoundInput {
  clubSlug: string;
  conditionId: string;
  marketId: string;
  marketSlug: string;
  marketTitle?: string;
  commentary?: string;
  commitAmount: string;
  targetTokenId: string;
  targetOutcome: string;
  adminUserId: string;
}

export interface ListPredictionRoundsInput {
  clubSlug: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export class PredictionRoundController {
  /**
   * Create a new prediction round (commit funds to a market)
   */
  static async createPredictionRound(input: CreatePredictionRoundInput) {
    const {
      clubSlug,
      conditionId,
      marketId,
      marketSlug,
      marketTitle,
      commentary,
      commitAmount,
      targetTokenId,
      targetOutcome,
      adminUserId,
    } = input;
    const club = await this.getClubOrThrow(clubSlug);

    await this.requireAdminOrThrow(club.id, adminUserId);

    const activeMembers = await ClubController.getActiveMembers(club.id);
    if (activeMembers.length === 0) {
      throw new LedgerError('NO_ACTIVE_MEMBERS', 'No active members in this club');
    }

    const stakeTotal = (BigInt(commitAmount) * BigInt(activeMembers.length)).toString();

    const memberIds = activeMembers.map((member) => member.userId);
    let clubWalletByUser: Map<
      string,
      {
        id: string;
        safeAddress: string;
      }
    >;
    try {
      const wallets = await ClubWalletController.requireActiveClubWallets({
        clubId: club.id,
        userIds: memberIds,
      });
      clubWalletByUser = new Map(
        Array.from(wallets.entries()).map(([userId, wallet]) => [
          userId,
          { id: wallet.id, safeAddress: wallet.polymarketSafeAddress ?? '' },
        ])
      );
    } catch (error) {
      if (error instanceof ClubWalletError) {
        throw new LedgerError(error.code, error.message);
      }
      throw error;
    }

    const predictionRound = await prisma.$transaction(async (tx) => {
      const created = await tx.predictionRound.create({
        data: {
          clubId: club.id,
          createdByUserId: adminUserId,
          conditionId,
          marketId,
          marketSlug,
          marketTitle,
          commentary,
          targetTokenId,
          targetOutcome,
          stakeTotal,
          status: 'PENDING',
          members: {
            create: activeMembers.map((m) => ({
              userId: m.userId,
              commitAmount,
            })),
          },
        },
        include: {
          members: true,
        },
      });

      await LedgerController.createEntries(
        activeMembers.map((member) => ({
          safeAddress: clubWalletByUser.get(member.userId)?.safeAddress ?? '',
          clubWalletId: clubWalletByUser.get(member.userId)?.id ?? null,
          clubId: club.id,
          userId: member.userId,
          predictionRoundId: created.id,
          type: 'COMMIT',
          amount: `-${commitAmount}`,
          asset: 'USDC.e',
          metadata: undefined,
          txHash: undefined,
        })),
        tx as Parameters<typeof LedgerController.createEntries>[1]
      );

      return created;
    });

    return predictionRound;
  }

  /**
   * List prediction rounds for a club
   */
  static async listPredictionRounds(input: ListPredictionRoundsInput) {
    const { clubSlug, page = 1, pageSize = 20, status } = input;
    const club = await this.getClubOrThrow(clubSlug);

    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = { clubId: club.id };

    if (status) {
      where.status = status;
    }

    const [predictionRounds, total] = await Promise.all([
      prisma.predictionRound.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { members: true },
          },
        },
      }),
      prisma.predictionRound.count({ where }),
    ]);

    return {
      items: predictionRounds,
      total,
      page,
      pageSize,
      hasMore: skip + predictionRounds.length < total,
    };
  }

  private static async getClubOrThrow(slug: string) {
    try {
      return await ClubController.getBySlug(slug);
    } catch (error) {
      if (error instanceof ClubError && error.code === 'NOT_FOUND') {
        throw new LedgerError('CLUB_NOT_FOUND', 'Club not found');
      }
      throw error;
    }
  }

  private static async requireAdminOrThrow(clubId: string, userId: string) {
    try {
      await ClubController.requireAdmin(clubId, userId);
    } catch (error) {
      if (error instanceof ClubError && error.code === 'FORBIDDEN') {
        throw new LedgerError('FORBIDDEN', 'Only club admins can perform this action');
      }
      throw error;
    }
  }
}

export const PredictionRoundError = LedgerError;
