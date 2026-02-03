'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@prediction-club/ui';
import type { ClubListItem } from '@/hooks';
import { useClubPerformance } from '@/hooks';

type ClubCardProps = {
  club: ClubListItem;
  statsLabel: 'members' | 'predictions';
};

export function ClubCard({ club, statsLabel }: ClubCardProps) {
  const { performance, isLoading, hasActivity } = useClubPerformance(club.slug, 30);
  const aprLabel = useMemo(() => {
    if (!performance || !hasActivity) return null;
    const aprPct = (performance.apr ?? 0) * 100;
    const simplePct = (performance.simpleReturn ?? 0) * 100;
    const format = (v: number) =>
      `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    return `${format(simplePct)} (30d), APR ${format(aprPct)}`;
  }, [performance]);

  const statsValue = statsLabel === 'members' ? club._count.members : club._count.predictionRounds;
  const badgeLabel =
    statsLabel === 'members' ? `${statsValue} members` : `${statsValue} predictions`;

  return (
    <Link href={`/clubs/${club.slug}`} className="group">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{club.name}</CardTitle>
            <Badge variant="secondary" className="whitespace-nowrap">
              {badgeLabel}
            </Badge>
          </div>
          <CardDescription>/{club.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          {club.description && (
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{club.description}</p>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active volume</span>
            <span>${formatUsdAmount(club.activeCommittedVolume)}</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading performance...'
              : aprLabel || 'No 30d activity'}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
