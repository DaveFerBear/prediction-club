import { prisma } from '@prediction-club/db';
import { slugify } from '@prediction-club/shared';

export interface CreateClubInput {
  name: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
}

export interface ListClubsInput {
  page?: number;
  pageSize?: number;
  userId: string;
}

export interface ListPublicClubsInput {
  page?: number;
  pageSize?: number;
}

export interface UpdateClubInput {
  name: string;
  description?: string | null;
  isPublic: boolean;
}

export class ClubController {
  static async isAdmin(clubId: string, userId: string) {
    const member = await prisma.clubMember.findFirst({
      where: {
        clubId,
        userId,
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    });

    return !!member;
  }

  static async getActiveMembers(clubId: string) {
    return prisma.clubMember.findMany({
      where: {
        clubId,
        status: 'ACTIVE',
      },
      select: {
        userId: true,
      },
    });
  }

  static async requireAdmin(clubId: string, userId: string) {
    const isAdmin = await this.isAdmin(clubId, userId);
    if (!isAdmin) {
      throw new ClubError('FORBIDDEN', 'Only club admins can perform this action');
    }
  }

  /**
   * Create a new club
   */
  static async create(input: CreateClubInput, userId: string) {
    const { name, description, isPublic = false } = input;
    const slug = input.slug || slugify(name);

    // Check if slug is already taken
    const existingClub = await prisma.club.findUnique({
      where: { slug },
    });

    if (existingClub) {
      throw new ClubError('SLUG_TAKEN', 'This club slug is already taken');
    }

    return prisma.$transaction(async (tx) => {
      const createdClub = await tx.club.create({
        data: {
          name,
          slug,
          description,
          isPublic,
          createdByUserId: userId,
          members: {
            create: {
              userId,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
          },
        },
      });

      return createdClub;
    });
  }

  /**
   * List clubs with pagination
   */
  static async listForUser(input: ListClubsInput) {
    const { page = 1, pageSize = 10, userId } = input;
    const skip = (page - 1) * pageSize;
    const where = {
      members: { some: { userId, status: 'ACTIVE' as const } },
    };

    const [clubs, total] = await Promise.all([
      prisma.club.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { members: true, predictionRounds: true },
          },
        },
      }),
      prisma.club.count({ where }),
    ]);

    return {
      items: clubs,
      total,
      page,
      pageSize,
      hasMore: skip + clubs.length < total,
    };
  }

  static async listPublic(input: ListPublicClubsInput = {}) {
    const { page = 1, pageSize = 10 } = input;
    const skip = (page - 1) * pageSize;
    const where = { isPublic: true };

    const [clubs, total] = await Promise.all([
      prisma.club.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { members: true, predictionRounds: true },
          },
        },
      }),
      prisma.club.count({ where }),
    ]);

    return {
      items: clubs,
      total,
      page,
      pageSize,
      hasMore: skip + clubs.length < total,
    };
  }

  /**
   * Get a club by slug
   */
  static async getBySlug(slug: string) {
    const club = await prisma.club.findUnique({
      where: { slug },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: {
                id: true,
                walletAddress: true,
                email: true,
              },
            },
          },
        },
        predictionRounds: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
            predictionRounds: true,
          },
        },
      },
    });

    if (!club) {
      throw new ClubError('NOT_FOUND', 'Club not found');
    }

    return club;
  }

  /**
   * Update club details (admin only)
   */
  static async updateDetails(slug: string, input: UpdateClubInput, userId: string) {
    const club = await prisma.club.findUnique({
      where: { slug },
    });

    if (!club) {
      throw new ClubError('NOT_FOUND', 'Club not found');
    }

    const isAdmin = await ClubController.isAdmin(club.id, userId);

    if (!isAdmin) {
      throw new ClubError('FORBIDDEN', 'Only club admins can update club details');
    }

    const updatedClub = await prisma.club.update({
      where: { id: club.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        isPublic: input.isPublic,
      },
    });

    return updatedClub;
  }
}

export class ClubError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ClubError';
  }
}
