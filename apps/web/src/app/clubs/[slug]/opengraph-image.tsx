import { ImageResponse } from 'next/og';
import { prisma } from '@prediction-club/db';
import {
  computeClubPerformanceFromRounds,
  type RoundMemberLike,
  type OpenRoundMemberLike,
} from '@/lib/performance';
import { fetchMidpointPrices } from '@/lib/polymarket-prices';
import { POLYMARKET_CLOB_URL } from '@/lib/polymarket';

type PricePoint = { t: number; p: number };

async function fetchSparklinePoints(tokenId: string): Promise<string | null> {
  try {
    const url = new URL('/prices-history', POLYMARKET_CLOB_URL);
    url.searchParams.set('market', tokenId);
    url.searchParams.set('interval', 'max');
    url.searchParams.set('fidelity', '40');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as { history: PricePoint[] };
    const pts = data.history;
    if (!pts || pts.length < 2) return null;

    const prices = pts.map((p) => p.p);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 500;
    const h = 160;
    const pad = 4;

    return pts
      .map((pt, i) => {
        const x = (i / (pts.length - 1)) * w;
        const y = pad + (1 - (pt.p - min) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';
export const alt = 'Club preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: { slug: string } }) {
  const club = await prisma.club.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });

  if (!club) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            color: '#fff',
            fontSize: 48,
            fontFamily: 'sans-serif',
          }}
        >
          Prediction Club
        </div>
      ),
      size
    );
  }

  // Compute 30d mark-to-market performance
  const [settledMembers, openMembers] = await Promise.all([
    prisma.predictionRoundMember.findMany({
      where: { predictionRound: { clubId: club.id, status: 'SETTLED' } },
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
          clubId: club.id,
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
  const openForClub = openMembers as unknown as OpenRoundMemberLike[];

  const perf = computeClubPerformanceFromRounds(
    settledMembers as unknown as RoundMemberLike[],
    30,
    undefined,
    openForClub.length > 0 ? { members: openForClub, prices } : undefined
  );

  const returnPct = perf.hasWindowActivity ? perf.simpleReturn * 100 : null;
  const returnText =
    returnPct != null
      ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`
      : 'No activity';
  const returnColor =
    returnPct == null ? '#94a3b8' : returnPct >= 0 ? '#22c55e' : '#ef4444';

  // Fetch sparkline for the most recent committed prediction
  const latestRound = await prisma.predictionRound.findFirst({
    where: { clubId: club.id, status: { in: ['COMMITTED', 'RESOLVED'] } },
    orderBy: { createdAt: 'desc' },
    select: { targetTokenId: true },
  });
  const sparkline = latestRound ? await fetchSparklinePoints(latestRound.targetTokenId) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          backgroundColor: '#0f172a',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: '#94a3b8',
              letterSpacing: '0.1em',
            }}
          >
            PREDICTION CLUB
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 700,
              marginTop: 24,
              lineHeight: 1.1,
            }}
          >
            {club.name}
          </div>
        </div>

        {sparkline ? (
          <div style={{ display: 'flex', marginTop: 16 }}>
            <svg width="500" height="160" viewBox="0 0 500 160">
              <polyline
                points={sparkline}
                fill="none"
                stroke={returnColor}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 20, color: '#94a3b8' }}>30d return</div>
            <div
              style={{
                display: 'flex',
                fontSize: 96,
                fontWeight: 900,
                color: returnColor,
                lineHeight: 1.1,
              }}
            >
              {returnText}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#64748b' }}>
            {`${club._count.members} member${club._count.members !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>
    ),
    size
  );
}
