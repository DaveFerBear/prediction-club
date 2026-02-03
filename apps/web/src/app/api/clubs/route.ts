import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ClubController, ClubError, LedgerController } from '@/controllers';
import { computeClubPerformanceFromRounds, type RoundMemberLike } from '@/lib/performance';
import { apiResponse, apiError, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';
const createClubSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
});

/**
 * POST /api/clubs
 * Create a new club
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = createClubSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const club = await ClubController.create(parsed.data, user.id);
    return apiResponse(club, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      return apiError(error.code, error.message, 409);
    }
    console.error('Error creating club:', error);
    return serverError();
  }
}

/**
 * GET /api/clubs
 * List clubs for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const result = await ClubController.listForUser({ page, pageSize, userId: user.id });
    const clubIds = result.items.map((club) => club.id);
    const volumeByClub = await LedgerController.getClubsActiveCommitVolume({ clubIds });

    const perfByClub = new Map<string, { simpleReturn: number; hasWindowActivity: boolean }>();

    if (clubIds.length > 0) {
      const members = await prisma.predictionRoundMember.findMany({
        where: { predictionRound: { clubId: { in: clubIds } } },
        select: {
          commitAmount: true,
          payoutAmount: true,
          pnlAmount: true,
          predictionRound: { select: { clubId: true, createdAt: true } },
        },
      });
      const membersByClub = new Map<string, RoundMemberLike[]>();
      for (const m of members as unknown as RoundMemberLike[]) {
        const list = membersByClub.get(m.predictionRound.clubId) ?? [];
        list.push(m);
        membersByClub.set(m.predictionRound.clubId, list);
      }
      for (const clubId of clubIds) {
        const perf = computeClubPerformanceFromRounds(membersByClub.get(clubId) ?? [], 30);
        perfByClub.set(clubId, perf);
      }
    }

    const items = result.items.map((club) => ({
      ...club,
      activeCommittedVolume: volumeByClub.get(club.id) ?? '0',
      performance: perfByClub.get(club.id) ?? null,
    }));
    return apiResponse({ ...result, items });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error listing clubs:', error);
    return serverError();
  }
}
