import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { ClubController, LedgerController } from '@/controllers';
import { computeClubPerformanceFromRounds, type RoundMemberLike, type OpenRoundMemberLike } from '@/lib/performance';
import { apiResponse, serverError } from '@/lib/api';
import { fetchMidpointPrices } from '@/lib/polymarket-prices';

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

    const perfByClub = new Map<string, ReturnType<typeof computeClubPerformanceFromRounds>>();
    if (clubIds.length > 0) {
      const [settledMembers, openMembers] = await Promise.all([
        prisma.predictionRoundMember.findMany({
          where: {
            predictionRound: {
              clubId: { in: clubIds },
              status: 'SETTLED',
            },
          },
          select: {
            commitAmount: true,
            payoutAmount: true,
            pnlAmount: true,
            predictionRound: { select: { clubId: true, createdAt: true, status: true } },
          },
        }),
        prisma.predictionRoundMember.findMany({
          where: {
            predictionRound: {
              clubId: { in: clubIds },
              status: { in: ['COMMITTED', 'RESOLVED'] },
            },
          },
          select: {
            commitAmount: true,
            orderPrice: true,
            predictionRound: {
              select: {
                clubId: true,
                createdAt: true,
                status: true,
                targetTokenId: true,
                outcome: true,
                targetOutcome: true,
              },
            },
          },
        }),
      ]);

      const tokenIds = [
        ...new Set(
          openMembers
            .filter((m) => m.predictionRound.status === 'COMMITTED')
            .map((m) => m.predictionRound.targetTokenId)
        ),
      ];
      const prices = await fetchMidpointPrices(tokenIds);

      const membersByClub = new Map<string, RoundMemberLike[]>();
      for (const m of settledMembers as unknown as RoundMemberLike[]) {
        const list = membersByClub.get(m.predictionRound.clubId) ?? [];
        list.push(m);
        membersByClub.set(m.predictionRound.clubId, list);
      }

      const openByClub = new Map<string, OpenRoundMemberLike[]>();
      for (const m of openMembers as unknown as OpenRoundMemberLike[]) {
        const list = openByClub.get(m.predictionRound.clubId) ?? [];
        list.push(m);
        openByClub.set(m.predictionRound.clubId, list);
      }

      for (const clubId of clubIds) {
        const openForClub = openByClub.get(clubId) ?? [];
        const perf = computeClubPerformanceFromRounds(
          membersByClub.get(clubId) ?? [],
          30,
          undefined,
          openForClub.length > 0 ? { members: openForClub, prices } : undefined
        );
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
