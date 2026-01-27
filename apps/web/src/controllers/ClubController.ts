import { prisma } from '@prediction-club/db';
import { slugify } from '@prediction-club/shared';

export interface CreateClubInput {
  name: string;
  slug?: string;
  description?: string;
  safeAddress: string;
  vaultAddress: string;
  chainId: number;
  isPublic?: boolean;
}

export interface ListClubsInput {
  page?: number;
  pageSize?: number;
  publicOnly?: boolean;
}

export class ClubController {
  /**
   * Create a new club
   */
  static async create(input: CreateClubInput, userId: string) {
    const { name, description, safeAddress, vaultAddress, chainId, isPublic = false } = input;
    const slug = input.slug || slugify(name);

    // Check if slug is already taken
    const existingClub = await prisma.club.findUnique({
      where: { slug },
    });

    if (existingClub) {
      throw new ClubError('SLUG_TAKEN', 'This club slug is already taken');
    }

    // Check if vault/safe already registered
    const existingVault = await prisma.club.findFirst({
      where: {
        chainId,
        OR: [{ vaultAddress }, { safeAddress }],
      },
    });

    if (existingVault) {
      throw new ClubError('ADDRESS_REGISTERED', 'Vault or Safe address already registered');
    }

    // Create the club
    const club = await prisma.club.create({
      data: {
        name,
        slug,
        description,
        safeAddress,
        vaultAddress,
        chainId,
        isPublic,
        managerUserId: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    });

    return club;
  }

  /**
   * List clubs with pagination
   */
  static async list(input: ListClubsInput = {}) {
    const { page = 1, pageSize = 10, publicOnly = true } = input;
    const skip = (page - 1) * pageSize;
    const where = publicOnly ? { isPublic: true } : {};

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
        manager: {
          select: {
            id: true,
            walletAddress: true,
            email: true,
          },
        },
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
