import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ClubController, ClubError, LedgerController } from '@/controllers';
import {
  apiResponse,
  apiError,
  validationError,
  notFoundError,
  forbiddenError,
  unauthorizedError,
  serverError,
} from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';
import { computeClubPerformanceFromRounds, type RoundMemberLike } from '@/lib/performance';

const updateClubSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean(),
});

/**
 * GET /api/clubs/[slug]
 * Get a club by slug
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const club = await ClubController.getBySlug(params.slug);
    const activeCommittedVolume = await LedgerController.getClubActiveCommitVolume({
      clubId: club.id,
    });

    const roundMembers = await prisma.predictionRoundMember.findMany({
      where: { predictionRound: { clubId: club.id } },
      select: {
        commitAmount: true,
        payoutAmount: true,
        pnlAmount: true,
        predictionRound: { select: { clubId: true, createdAt: true } },
      },
    });
    const performance = computeClubPerformanceFromRounds(
      roundMembers as unknown as RoundMemberLike[],
      30
    );

    return apiResponse({ ...club, activeCommittedVolume, performance });
  } catch (error) {
    if (error instanceof ClubError && error.code === 'NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error fetching club:', error);
    return serverError();
  }
}

/**
 * PATCH /api/clubs/[slug]
 * Update club details (admin only)
 */
export async function PATCH(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = updateClubSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const description = parsed.data.description?.trim();
    const club = await ClubController.updateDetails(
      params.slug,
      {
        name: parsed.data.name.trim(),
        description: description ? description : null,
        isPublic: parsed.data.isPublic,
      },
      user.id
    );

    return apiResponse(club);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      if (error.code === 'NOT_FOUND') {
        return notFoundError('Club');
      }
      if (error.code === 'FORBIDDEN') {
        return forbiddenError(error.message);
      }
      return apiError(error.code, error.message, 400);
    }
    console.error('Error updating club:', error);
    return serverError();
  }
}
