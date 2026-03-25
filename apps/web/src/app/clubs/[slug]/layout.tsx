import type { Metadata } from 'next';
import { prisma } from '@prediction-club/db';
import {
  computeClubPerformanceFromRounds,
  type RoundMemberLike,
  type OpenRoundMemberLike,
} from '@/lib/performance';
import { fetchMidpointPrices } from '@/lib/polymarket-prices';

async function getClubReturn(clubId: string): Promise<string | null> {
  try {
    const [settled, open] = await Promise.all([
      prisma.predictionRoundMember.findMany({
        where: { predictionRound: { clubId, status: 'SETTLED' } },
        select: {
          commitAmount: true,
          payoutAmount: true,
          pnlAmount: true,
          predictionRound: { select: { clubId: true, createdAt: true, status: true } },
        },
      }),
      prisma.predictionRoundMember.findMany({
        where: { predictionRound: { clubId, status: { in: ['COMMITTED', 'RESOLVED'] } } },
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
        open
          .filter((m) => m.predictionRound.status === 'COMMITTED')
          .map((m) => m.predictionRound.targetTokenId)
      ),
    ];
    const prices = await fetchMidpointPrices(tokenIds);
    const openMembers = open as unknown as OpenRoundMemberLike[];

    const perf = computeClubPerformanceFromRounds(
      settled as unknown as RoundMemberLike[],
      30,
      undefined,
      openMembers.length > 0 ? { members: openMembers, prices } : undefined
    );

    if (!perf.hasWindowActivity) return null;
    const pct = perf.simpleReturn * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const club = await prisma.club.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    if (!club) {
      return {
        title: 'Club | Prediction Club',
        description: 'Trade predictions together on Polymarket.',
      };
    }

    const title = `${club.name} | Prediction Club`;
    const returnPct = await getClubReturn(club.id);

    const parts: string[] = [];
    if (returnPct) parts.push(`30d return: ${returnPct}`);
    const clubDesc = club.description?.trim();
    if (clubDesc) {
      parts.push(clubDesc);
    } else {
      parts.push('Trade predictions together on Polymarket.');
    }
    const description = parts.join(' · ');

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'Club | Prediction Club',
      description: 'Trade predictions together on Polymarket.',
    };
  }
}

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
