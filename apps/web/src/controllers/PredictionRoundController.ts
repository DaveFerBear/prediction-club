import { prisma } from '@prediction-club/db';
import { ClubController, ClubError } from './ClubController';
import { LedgerController, LedgerError } from './LedgerController';

export interface CreatePredictionRoundInput {
  clubSlug: string;
  marketRef?: string;
  marketTitle?: string;
  members: Array<{
    userId: string;
    commitAmount: string;
  }>;
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
    const { clubSlug, marketRef, marketTitle, members, adminUserId } = input;
    let club;
    try {
      club = await ClubController.getBySlug(clubSlug);
    } catch (error) {
      if (error instanceof ClubError && error.code === 'NOT_FOUND') {
        throw new LedgerError('CLUB_NOT_FOUND', 'Club not found');
      }
      throw error;
    }

    await LedgerController.requireAdmin(club.id, adminUserId);

    const stakeTotal = members
      .reduce((sum, m) => sum + BigInt(m.commitAmount), BigInt(0))
      .toString();

    const memberIds = members.map((member) => member.userId);
    const memberSafes = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        polymarketSafeAddress: true,
      },
    });
    const safeByUser = new Map(
      memberSafes.map((member) => [member.id, member.polymarketSafeAddress])
    );
    for (const member of members) {
      const safeAddress = safeByUser.get(member.userId);
      if (!safeAddress) {
        throw new LedgerError('SAFE_NOT_FOUND', 'Member Safe address not available');
      }
    }

    const predictionRound = await prisma.$transaction(async (tx) => {
      const created = await tx.predictionRound.create({
        data: {
          clubId: club.id,
          marketRef,
          marketTitle,
          stakeTotal,
          status: 'PENDING',
          members: {
            create: members.map((m) => ({
              userId: m.userId,
              commitAmount: m.commitAmount,
            })),
          },
        },
        include: {
          members: true,
        },
      });

      await tx.ledgerEntry.createMany({
        data: members.map((member) => ({
          safeAddress: safeByUser.get(member.userId) ?? '',
          clubId: club.id,
          userId: member.userId,
          predictionRoundId: created.id,
          type: 'COMMIT',
          amount: `-${member.commitAmount}`,
          asset: 'USDC.e',
        })),
      });

      return created;
    });

    return predictionRound;
  }

  /**
   * List prediction rounds for a club
   */
  static async listPredictionRounds(input: ListPredictionRoundsInput) {
    const { clubSlug, page = 1, pageSize = 20, status } = input;
    let club;
    try {
      club = await ClubController.getBySlug(clubSlug);
    } catch (error) {
      if (error instanceof ClubError && error.code === 'NOT_FOUND') {
        throw new LedgerError('CLUB_NOT_FOUND', 'Club not found');
      }
      throw error;
    }

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
}

export const PredictionRoundError = LedgerError;
