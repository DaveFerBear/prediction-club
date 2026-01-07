import { prisma } from '@prediction-club/db';
import { createChainPublicClient, getMemberBalance, buildWithdrawTx, type SupportedChainId } from '@prediction-club/chain';

// ============ Balance Operations ============

export interface GetBalanceInput {
  clubSlug: string;
  memberAddress?: string;
}

// ============ Withdraw Operations ============

export interface RequestWithdrawInput {
  clubSlug: string;
  userId: string;
  amount: string;
}

// ============ Cohort Operations ============

export interface CreateCohortInput {
  clubSlug: string;
  cohortId: string;
  marketRef?: string;
  marketTitle?: string;
  members: Array<{
    userId: string;
    commitAmount: string;
  }>;
  adminUserId: string;
}

export interface ListCohortsInput {
  clubSlug: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export class VaultController {
  // ============ Helper ============

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
    const member = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId,
          userId,
        },
      },
    });

    if (!member || member.role !== 'ADMIN') {
      throw new VaultError('FORBIDDEN', 'Only club admins can perform this action');
    }

    return member;
  }

  // ============ Balance ============

  /**
   * Get balance for a member in a club
   */
  static async getBalance(input: GetBalanceInput) {
    const { clubSlug, memberAddress } = input;
    const club = await this.getClubBySlug(clubSlug);

    // If no member specified, return vault contract info
    if (!memberAddress) {
      return {
        clubId: club.id,
        vaultAddress: club.vaultAddress,
        safeAddress: club.safeAddress,
        chainId: club.chainId,
      };
    }

    // Get on-chain balance
    try {
      const client = createChainPublicClient(club.chainId as SupportedChainId);
      const balance = await getMemberBalance(
        client,
        club.vaultAddress as `0x${string}`,
        memberAddress as `0x${string}`
      );

      return {
        clubId: club.id,
        member: memberAddress,
        available: balance.available.toString(),
        committed: balance.committed.toString(),
        total: balance.total.toString(),
        withdrawAddress: balance.withdrawAddress,
      };
    } catch (chainError) {
      console.error('Chain call failed:', chainError);
      return {
        clubId: club.id,
        member: memberAddress,
        available: '0',
        committed: '0',
        total: '0',
        withdrawAddress: memberAddress,
        error: 'Failed to fetch on-chain balance',
      };
    }
  }

  // ============ Withdraw ============

  /**
   * Request a withdrawal from the club vault
   */
  static async requestWithdraw(input: RequestWithdrawInput) {
    const { clubSlug, userId, amount } = input;
    const club = await this.getClubBySlug(clubSlug);

    // Check if user is a member
    const member = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
          userId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!member || member.status !== 'ACTIVE') {
      throw new VaultError('NOT_A_MEMBER', 'You are not an active member of this club');
    }

    // Build the withdraw transaction
    const withdrawTx = buildWithdrawTx(
      club.vaultAddress as `0x${string}`,
      member.user.walletAddress as `0x${string}`,
      BigInt(amount)
    );

    return {
      clubId: club.id,
      member: member.user.walletAddress,
      amount,
      transaction: withdrawTx,
      status: 'PENDING_SIGNATURE',
      message: 'Withdrawal request created. Awaiting Safe signature.',
    };
  }

  // ============ Cohorts ============

  /**
   * Create a new cohort (commit funds to a market)
   */
  static async createCohort(input: CreateCohortInput) {
    const { clubSlug, cohortId, marketRef, marketTitle, members, adminUserId } = input;
    const club = await this.getClubBySlug(clubSlug);

    await this.requireAdmin(club.id, adminUserId);

    // Calculate total stake
    const stakeTotal = members
      .reduce((sum, m) => sum + BigInt(m.commitAmount), BigInt(0))
      .toString();

    // Create cohort with members
    const cohort = await prisma.cohort.create({
      data: {
        clubId: club.id,
        cohortId,
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

    return cohort;
  }

  /**
   * List cohorts for a club
   */
  static async listCohorts(input: ListCohortsInput) {
    const { clubSlug, page = 1, pageSize = 20, status } = input;
    const club = await this.getClubBySlug(clubSlug);

    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = { clubId: club.id };

    if (status) {
      where.status = status;
    }

    const [cohorts, total] = await Promise.all([
      prisma.cohort.findMany({
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
      prisma.cohort.count({ where }),
    ]);

    return {
      items: cohorts,
      total,
      page,
      pageSize,
      hasMore: skip + cohorts.length < total,
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
