import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { apiResponse, notFoundError, serverError } from '@/lib/api';

/**
 * GET /api/clubs/[slug]
 * Get a club by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const club = await prisma.club.findUnique({
      where: { slug: params.slug },
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
        cohorts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
            cohorts: true,
          },
        },
      },
    });

    if (!club) {
      return notFoundError('Club');
    }

    // If club is private, check authorization
    // TODO: Implement auth check
    // For now, return club data

    return apiResponse(club);
  } catch (error) {
    console.error('Error fetching club:', error);
    return serverError();
  }
}
