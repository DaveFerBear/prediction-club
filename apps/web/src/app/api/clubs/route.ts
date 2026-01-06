import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@prediction-club/db';
import { apiResponse, apiError, validationError, serverError } from '@/lib/api';
import { slugify, isValidAddress } from '@prediction-club/shared';

// Request validation schema
const createClubSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  safeAddress: z.string().refine(isValidAddress, 'Invalid Safe address'),
  vaultAddress: z.string().refine(isValidAddress, 'Invalid Vault address'),
  chainId: z.number().int().positive(),
  isPublic: z.boolean().optional().default(false),
});

/**
 * POST /api/clubs
 * Create a new club
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createClubSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const { name, description, safeAddress, vaultAddress, chainId, isPublic } = parsed.data;
    const slug = parsed.data.slug || slugify(name);

    // TODO: Get authenticated user from session
    // For now, use a placeholder user ID
    const userId = 'placeholder-user-id';

    // Check if slug is already taken
    const existingClub = await prisma.club.findUnique({
      where: { slug },
    });

    if (existingClub) {
      return apiError('SLUG_TAKEN', 'This club slug is already taken', 409);
    }

    // Check if vault/safe already registered
    const existingVault = await prisma.club.findFirst({
      where: {
        chainId,
        OR: [{ vaultAddress }, { safeAddress }],
      },
    });

    if (existingVault) {
      return apiError('ADDRESS_REGISTERED', 'Vault or Safe address already registered', 409);
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

    return apiResponse(club, 201);
  } catch (error) {
    console.error('Error creating club:', error);
    return serverError();
  }
}

/**
 * GET /api/clubs
 * List public clubs (or user's clubs if authenticated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const publicOnly = searchParams.get('public') !== 'false';

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
            select: { members: true, cohorts: true },
          },
        },
      }),
      prisma.club.count({ where }),
    ]);

    return apiResponse({
      items: clubs,
      total,
      page,
      pageSize,
      hasMore: skip + clubs.length < total,
    });
  } catch (error) {
    console.error('Error listing clubs:', error);
    return serverError();
  }
}
