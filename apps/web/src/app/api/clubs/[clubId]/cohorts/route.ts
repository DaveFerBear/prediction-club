import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@prediction-club/db';
import { apiResponse, validationError, notFoundError, forbiddenError, serverError } from '@/lib/api';
import { isValidBytes32 } from '@prediction-club/shared';

const createCohortSchema = z.object({
  cohortId: z.string().refine(isValidBytes32, 'Invalid cohort ID (must be bytes32)'),
  marketRef: z.string().max(500).optional(),
  marketTitle: z.string().max(200).optional(),
  members: z.array(
    z.object({
      userId: z.string(),
      commitAmount: z.string(), // BigInt as string
    })
  ),
});

/**
 * POST /api/clubs/[clubId]/cohorts
 * Create a new cohort
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string } }
) {
  try {
    const body = await request.json();
    const parsed = createCohortSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    // TODO: Get authenticated user from session
    const currentUserId = 'placeholder-user-id';

    // Check if current user is admin of the club
    const currentMember = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: params.clubId,
          userId: currentUserId,
        },
      },
    });

    if (!currentMember || currentMember.role !== 'ADMIN') {
      return forbiddenError('Only club admins can create cohorts');
    }

    // Check if club exists
    const club = await prisma.club.findUnique({
      where: { id: params.clubId },
    });

    if (!club) {
      return notFoundError('Club');
    }

    const { cohortId, marketRef, marketTitle, members } = parsed.data;

    // Calculate total stake
    const stakeTotal = members
      .reduce((sum, m) => sum + BigInt(m.commitAmount), 0n)
      .toString();

    // Create cohort with members
    const cohort = await prisma.cohort.create({
      data: {
        clubId: params.clubId,
        cohortId,
        marketRef,
        marketTitle,
        stakeTotal,
        status: 'PENDING',
        members: {
          create: members.map((m) => ({
            userId: m.userId,
            commitAmount: m.commitAmount,
            payoutAmount: '0',
            pnlAmount: '0',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                walletAddress: true,
              },
            },
          },
        },
      },
    });

    return apiResponse(cohort, 201);
  } catch (error) {
    console.error('Error creating cohort:', error);
    return serverError();
  }
}

/**
 * GET /api/clubs/[clubId]/cohorts
 * List cohorts for a club
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const cohorts = await prisma.cohort.findMany({
      where: {
        clubId: params.clubId,
        ...(status ? { status: status as 'PENDING' | 'COMMITTED' | 'SETTLED' | 'CANCELLED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return apiResponse(cohorts);
  } catch (error) {
    console.error('Error listing cohorts:', error);
    return serverError();
  }
}
