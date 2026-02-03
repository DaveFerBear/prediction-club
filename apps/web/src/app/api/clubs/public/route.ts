import { NextRequest } from 'next/server';
import { ClubController, LedgerController } from '@/controllers';
import { computeClubPerformanceFromRounds, type RoundMemberLike } from '@/lib/performance';
import { apiResponse, serverError } from '@/lib/api';

/**
 * GET /api/clubs/public
 * List public clubs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const result = await ClubController.listPublic({ page, pageSize });
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
    console.error('Error listing public clubs:', error);
    return serverError();
  }
}
