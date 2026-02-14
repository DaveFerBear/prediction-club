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
    'flex w-max gap-3 px-3 py-3 pr-8 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none',
  ].join(' ');

  return (
    <section aria-label="Top clubs">
      <div className="group overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-sm">
        <div className="overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={trackClassName}>
            {items.map((club, idx) => {
              const perf = returnUi(club);
              const PerfIcon = perf.icon;

              return (
                <Link
                  key={`${club.id}-${idx}`}
                  href={`/clubs/${club.slug}`}
                  className="group/item min-w-[250px] rounded-xl border border-border/60 bg-background/90 px-4 py-3 transition-all hover:-translate-y-[1px] hover:border-border hover:bg-background"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{club.name}</div>
                      <div className="truncate text-xs text-muted-foreground">/{club.slug}</div>
                    </div>
                    <div
                      className={[
                        'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
                        perf.className,
                      ].join(' ')}
                    >
                      <PerfIcon className="h-4 w-4" />
                      {perf.value}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-muted-foreground">Active volume</div>
                      <div className="font-semibold tabular-nums text-foreground">
                        ${formatUsdAmount(club.activeCommittedVolume)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Members</div>
                      <div className="font-semibold tabular-nums text-foreground">
                        {club._count.members.toLocaleString('en-US')}
                      </div>
                    </div>
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
