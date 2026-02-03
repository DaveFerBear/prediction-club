import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@prediction-club/db';
import { ClubController, LedgerController } from '@/controllers';
import { apiResponse, validationError, serverError } from '@/lib/api';
import { computeClubPerformance, computeClubPerformanceFromRounds } from '@/lib/performance';

const paramsSchema = z.object({
  slug: z.string().min(1),
});

const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

/**
 * GET /api/clubs/:slug/performance?days=30
 */
export async function GET(request: NextRequest, context: { params: unknown }) {
  try {
    const parsedParams = paramsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return validationError(parsedParams.error.errors[0].message);
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = querySchema.safeParse({
      days: searchParams.get('days') ?? undefined,
    });
    if (!parsedQuery.success) {
      return validationError(parsedQuery.error.errors[0].message);
    }

    const club = await ClubController.getBySlug(parsedParams.data.slug);
    const [history, roundMembers] = await Promise.all([
      LedgerController.getClubLedgerHistory({ clubId: club.id }),
      prisma.predictionRoundMember.findMany({
        where: {
          predictionRound: {
            clubId: club.id,
          },
        },
        select: {
          commitAmount: true,
          payoutAmount: true,
          pnlAmount: true,
          predictionRound: {
            select: { createdAt: true },
          },
        },
      }),
    ]);

    const performance =
      computeClubPerformanceFromRounds(roundMembers, parsedQuery.data.days) ??
      computeClubPerformance(history, parsedQuery.data.days);

    return apiResponse({ performance });
  } catch (error) {
    console.error('Error fetching club performance:', error);
    return serverError();
  }
}
