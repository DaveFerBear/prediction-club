import { prisma } from '@prediction-club/db';
import { ClubController } from './ClubController';

// ============ Prediction Round Operations ============

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

export class VaultController {
  private static async getClubBySlug(slug: string) {
    const club = await prisma.club.findUnique({
      where: { slug },
    });

    if (!club) {
      throw new VaultError('CLUB_NOT_FOUND', 'Club not found');
    }

    return club;
  }

  private static async requireAdmin(clubId: string, userId: string) {
    const isAdmin = await ClubController.isAdmin(clubId, userId);

    if (!isAdmin) {
      throw new VaultError('FORBIDDEN', 'Only club admins can perform this action');
    }
  }

  /**
   * Create a new prediction round (commit funds to a market)
   */
  static async createPredictionRound(input: CreatePredictionRoundInput) {
    const { clubSlug, marketRef, marketTitle, members, adminUserId } = input;
    const club = await this.getClubBySlug(clubSlug);

    await this.requireAdmin(club.id, adminUserId);

    // Calculate total stake
    const stakeTotal = members
      .reduce((sum, m) => sum + BigInt(m.commitAmount), BigInt(0))
      .toString();

    // Create prediction round with members
    const predictionRound = await prisma.predictionRound.create({
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

    return predictionRound;
  }

  /**
   * List prediction rounds for a club
   */
  static async listPredictionRounds(input: ListPredictionRoundsInput) {
    const { clubSlug, page = 1, pageSize = 20, status } = input;
    const club = await this.getClubBySlug(clubSlug);

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

export class VaultError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'VaultError';
  }
}
