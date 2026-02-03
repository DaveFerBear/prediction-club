'use client';

import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';
import type { ClubListItem } from '@/hooks';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

type ClubCardProps = {
  club: ClubListItem;
  statsLabel: 'members' | 'predictions';
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function perfUI(perf?: ClubListItem['performance']) {
  if (!perf || !perf.hasWindowActivity) {
    return {
      icon: Minus,
      label: 'No activity',
      className: 'text-muted-foreground',
    };
  }

  const value = (perf.simpleReturn ?? 0) * 100;

  if (value > 0.05) {
    return {
      icon: TrendingUp,
      label: `+${value.toFixed(1)}%`,
      className: 'text-emerald-600 dark:text-emerald-400',
    };
  }

  if (value < -0.05) {
    return {
      icon: TrendingDown,
      label: `${value.toFixed(1)}%`,
      className: 'text-rose-600 dark:text-rose-400',
    };
  }

  return {
    icon: Minus,
    label: `${value.toFixed(1)}%`,
    className: 'text-muted-foreground',
  };
}

export function ClubCard({ club }: ClubCardProps) {
  const initials = getInitials(club.name);
  const perf = perfUI(club.performance);
  const PerfIcon = perf.icon;

  const volumeText = `$${formatUsdAmount(club.activeCommittedVolume)}`;
  const members = club._count.members;

  return (
    <Link href={`/clubs/${club.slug}`} className="group block">
      <Card
        className="
       relative
       border-border/70
       transition-all duration-150 ease-out
       hover:-translate-y-[1px]
       hover:shadow-md
       hover:border-border
       hover:z-10
     "
      >
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className={[
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                'border border-border/70 bg-muted/40',
                'text-sm font-semibold',
              ].join(' ')}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <CardTitle className="truncate leading-tight">{club.name}</CardTitle>

              {/* Inline metadata */}
              <CardDescription className="truncate">
                /{club.slug}
                <span className="mx-1 text-muted-foreground/50">•</span>
                <span>{members} members</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {club.description && (
            <p className="mb-4 text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {club.description}
            </p>
          )}

          {/* PRIMARY FINANCIAL ROW */}
          <div className="flex items-baseline justify-between gap-4">
            <div className="tabular-nums text-xl font-semibold tracking-tight">{volumeText}</div>

            <div
              className={[
                'flex items-center gap-1.5 tabular-nums font-semibold',
                perf.className,
              ].join(' ')}
            >
              <PerfIcon className="h-4 w-4" />
              {perf.label}
              <span className="text-xs text-muted-foreground ml-1">(30d)</span>
            </div>
          </div>

          {/* tiny label row */}
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Active volume</span>
            <span>Return</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
