import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { HomeClubItem } from '@/hooks';

type ClubTickerProps = {
  clubs: HomeClubItem[];
};

function returnUi(club: HomeClubItem) {
  const perf = club.performance;
  if (!perf || !perf.hasWindowActivity) {
    return {
      icon: Minus,
      value: 'No activity',
      className: 'text-muted-foreground',
    };
  }

  const pct = perf.simpleReturn * 100;
  if (pct > 0.05) {
    return {
      icon: TrendingUp,
      value: `+${pct.toFixed(1)}%`,
      className: 'text-emerald-600',
    };
  }

  if (pct < -0.05) {
    return {
      icon: TrendingDown,
      value: `${pct.toFixed(1)}%`,
      className: 'text-rose-600',
    };
  }

  return {
    icon: Minus,
    value: `${pct.toFixed(1)}%`,
    className: 'text-muted-foreground',
  };
}

export function ClubTicker({ clubs }: ClubTickerProps) {
  if (clubs.length === 0) return null;

  const items = clubs.length > 1 ? [...clubs, ...clubs] : clubs;
  const trackClassName = [
    clubs.length > 1 ? 'home-ticker-track' : '',
    'flex w-max gap-2 px-3 py-2 pr-8 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none',
  ].join(' ');

  return (
    <section aria-label="Top clubs">
      <div className="group overflow-hidden border-y border-border/70 bg-card/75">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={trackClassName}>
            {items.map((club, idx) => {
              const perf = returnUi(club);
              const PerfIcon = perf.icon;

              return (
                <Link
                  key={`${club.id}-${idx}`}
                  href={`/clubs/${club.slug}`}
                  className="group/item min-w-[220px] rounded-md border border-border/60 bg-background/90 px-3 py-2 transition-colors hover:border-border hover:bg-background"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{club.name}</div>
                    </div>
                    <div
                      className={[
                        'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
                        perf.className,
                      ].join(' ')}
                    >
                      <PerfIcon className="h-3.5 w-3.5" />
                      {perf.value}
                    </div>
                  </div>

                  <div className="mt-1.5 text-xs text-muted-foreground">
                    Vol <span className="font-semibold tabular-nums text-foreground">${formatUsdAmount(club.activeCommittedVolume)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
