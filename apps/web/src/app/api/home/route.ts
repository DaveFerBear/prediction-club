import { prisma } from '@prediction-club/db';
import { LedgerController } from '@/controllers';
import { apiResponse, serverError } from '@/lib/api';
import { computeClubPerformanceFromRounds, type RoundMemberLike } from '@/lib/performance';

type HomeClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdByUserId: string | null;
  activeCommittedVolume: string;
  performance: {
    days: number;
    navStart: string;
    navEnd: string;
    netFlows: string;
    simpleReturn: number;
    hasWindowActivity: boolean;
    realizedPnl: string;
  } | null;
  _count: {
    members: number;
    predictionRounds: number;
  };
};

type HomePayload = {
  kpis: {
    totalActiveVolume: string;
    medianSimpleReturn30d: number | null;
    publicClubCount: number;
  };
  clubs: HomeClub[];
  generatedAt: string;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function compareClubs(a: HomeClub, b: HomeClub): number {
  const volumeA = BigInt(a.activeCommittedVolume);
  const volumeB = BigInt(b.activeCommittedVolume);
  if (volumeA !== volumeB) {
    return volumeA > volumeB ? -1 : 1;
  }

  const returnA = a.performance?.hasWindowActivity ? a.performance.simpleReturn : -Infinity;
  const returnB = b.performance?.hasWindowActivity ? b.performance.simpleReturn : -Infinity;
  if (returnA !== returnB) {
    return returnB - returnA;
  }

  return a.name.localeCompare(b.name);
}

/**
 * GET /api/home
 * Aggregate public club metrics for the landing page.
 */
export async function GET() {
  try {
    const clubs = await prisma.club.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            members: true,
            predictionRounds: true,
          },
        },
      },
    });

    const clubIds = clubs.map((club) => club.id);
    const volumeByClub = await LedgerController.getClubsActiveCommitVolume({ clubIds });

    const perfByClub = new Map<string, ReturnType<typeof computeClubPerformanceFromRounds>>();
    if (clubIds.length > 0) {
      const members = await prisma.predictionRoundMember.findMany({
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
          predictionRound: {
            select: {
              clubId: true,
              createdAt: true,
              status: true,
            },
          },
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

    const enrichedClubs: HomeClub[] = clubs.map((club) => ({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      isPublic: club.isPublic,
      createdByUserId: club.createdByUserId,
      activeCommittedVolume: volumeByClub.get(club.id) ?? '0',
      performance: perfByClub.get(club.id) ?? null,
      _count: {
        members: club._count.members,
        predictionRounds: club._count.predictionRounds,
      },
    }));

    const totalActiveVolume = enrichedClubs.reduce(
      (sum, club) => sum + BigInt(club.activeCommittedVolume),
      0n
    );

    const returns = enrichedClubs
      .filter((club) => club.performance?.hasWindowActivity)
      .map((club) => club.performance?.simpleReturn ?? 0);

    const featuredClubs = [...enrichedClubs].sort(compareClubs).slice(0, 24);

    const payload: HomePayload = {
      kpis: {
        totalActiveVolume: totalActiveVolume.toString(),
        medianSimpleReturn30d: median(returns),
        publicClubCount: enrichedClubs.length,
      },
      clubs: featuredClubs,
      generatedAt: new Date().toISOString(),
    };

    return apiResponse(payload);
  } catch (error) {
    console.error('Error building home payload:', error);
    return serverError();
  }
}
