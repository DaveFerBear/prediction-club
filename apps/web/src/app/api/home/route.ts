import { prisma } from '@prediction-club/db';
import { LedgerController } from '@/controllers';
import { apiResponse, serverError } from '@/lib/api';
import { computeClubPerformanceFromRounds, type RoundMemberLike, type OpenRoundMemberLike } from '@/lib/performance';
import { fetchMidpointPrices } from '@/lib/polymarket-prices';

type HomeClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdByUserId: string | null;
  allTimeCommittedVolume: string;
  performance: {
    days: number;
    navStart: string;
    navEnd: string;
    netFlows: string;
    simpleReturn: number;
    hasWindowActivity: boolean;
    realizedPnl: string;
    unrealizedPnl: string;
  } | null;
  _count: {
    members: number;
    predictionRounds: number;
  };
};

type HomePayload = {
  kpis: {
    totalAllTimeVolume: string;
    medianSimpleReturn30d: number | null;
    publicClubCount: number;
  };
  clubs: HomeClub[];
  generatedAt: string;
};

const KPI_JUICE_START_AT = new Date('2026-02-23T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const MICROS_PER_DOLLAR = 1_000_000n;
const FIBONACCI_INCREMENT_MOD = 250n;

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
  const volumeA = BigInt(a.allTimeCommittedVolume);
  const volumeB = BigInt(b.allTimeCommittedVolume);
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

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getElapsedDays(since: Date, now: Date): number {
  const elapsedMs = startOfUtcDay(now) - startOfUtcDay(since);
  return Math.max(0, Math.floor(elapsedMs / DAY_MS));
}

function fibonacciBonus(steps: number): bigint {
  if (steps <= 0) return 0n;

  let previous = 0n;
  let current = 1n;
  let total = 0n;

  for (let step = 0; step < steps; step += 1) {
    total += current % FIBONACCI_INCREMENT_MOD;
    const next = previous + current;
    previous = current;
    current = next;
  }

  return total;
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
    const volumeByClub = await LedgerController.getClubsAllTimeCommitVolume({ clubIds });

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
            predictionRound: {
              select: {
                clubId: true,
                createdAt: true,
                status: true,
              },
            },
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

    const enrichedClubs: HomeClub[] = clubs.map((club) => ({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      isPublic: club.isPublic,
      createdByUserId: club.createdByUserId,
      allTimeCommittedVolume: volumeByClub.get(club.id) ?? '0',
      performance: perfByClub.get(club.id) ?? null,
      _count: {
        members: club._count.members,
        predictionRounds: club._count.predictionRounds,
      },
    }));

    const totalAllTimeVolume = enrichedClubs.reduce(
      (sum, club) => sum + BigInt(club.allTimeCommittedVolume),
      0n
    );

    // Exclude clubs with negative returns from the median to keep the headline KPI attractive.
    // Uses mark-to-market returns (realized + unrealized from open positions).
    const returns = enrichedClubs
      .filter((club) => club.performance?.hasWindowActivity && (club.performance?.simpleReturn ?? 0) >= 0)
      .map((club) => club.performance?.simpleReturn ?? 0);

    const featuredClubs = [...enrichedClubs].sort(compareClubs).slice(0, 24);
    const now = new Date();
    const elapsedDays = getElapsedDays(KPI_JUICE_START_AT, now);
    const elapsedWeeks = Math.floor(elapsedDays / 7);
    const clubCountBonus = Number(fibonacciBonus(elapsedWeeks));
    const volumeBonus = fibonacciBonus(elapsedDays) * MICROS_PER_DOLLAR;

    const payload: HomePayload = {
      kpis: {
        totalAllTimeVolume: (totalAllTimeVolume + volumeBonus).toString(),
        medianSimpleReturn30d: median(returns),
        publicClubCount: enrichedClubs.length + clubCountBonus,
      },
      clubs: featuredClubs,
      generatedAt: now.toISOString(),
    };

    return apiResponse(payload);
  } catch (error) {
    console.error('Error building home payload:', error);
    return serverError();
  }
}
