'use client';

import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { Button } from '@prediction-club/ui';
import { AlertTriangle } from 'lucide-react';
import { Header } from '@/components/header';
import { PolymarketIcon } from '@/components/icons/polymarket-icon';
import { LockIcon } from '@/components/icons/lock-icon';
import { ShieldCheckIcon } from '@/components/icons/shield-check-icon';
import { ClubTicker } from '@/components/home/club-ticker';
import { useHomeData } from '@/hooks';

export default function HomePage() {
  const { data, error } = useHomeData();
  const medianReturnLabel =
    data.kpis.medianSimpleReturn30d === null
      ? 'No settled activity'
      : `${data.kpis.medianSimpleReturn30d > 0 ? '+' : ''}${(data.kpis.medianSimpleReturn30d * 100).toFixed(1)}%`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="relative isolate overflow-hidden border-b bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/14 blur-3xl" />
            <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-emerald-400/14 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:56px_56px]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.018)_1px,transparent_1px)] bg-[size:14px_14px]" />
          </div>

          <div className="relative z-10">
            <Header variant="ghost" />
          </div>

          <div className="container relative z-10 py-16 md:py-24">
            <div className="mx-auto max-w-5xl">
              <div className="mx-auto max-w-3xl text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex items-center rounded-full border border-slate-900/10 bg-white/75 px-3 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_1px_rgba(15,23,42,0.05)] backdrop-blur">
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
                      Volume
                    </span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span className="text-base font-semibold tracking-tight tabular-nums text-slate-900">
                      ${formatUsdAmount(data.kpis.totalActiveVolume)}
                    </span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-slate-900/10 bg-white/75 px-3 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_1px_rgba(15,23,42,0.05)] backdrop-blur">
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
                      Median 30d
                    </span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span className="text-base font-semibold tracking-tight tabular-nums text-slate-900">
                      {medianReturnLabel}
                    </span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-slate-900/10 bg-white/75 px-3 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_1px_rgba(15,23,42,0.05)] backdrop-blur">
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
                      Clubs
                    </span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span className="text-base font-semibold tracking-tight tabular-nums text-slate-900">
                      {data.kpis.publicClubCount.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl">
                  Trade Predictions Together
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
                  Create, discover, and join prediction clubs to trade on Polymarket together.
                  Everyone keeps custody in their own Safe.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                  <Link href="/clubs/create">
                    <Button size="lg" className="min-w-[140px] shadow-lg shadow-primary/15">
                      Start a Club
                    </Button>
                  </Link>
                  <Link href="/clubs">
                    <Button variant="outline" size="lg" className="min-w-[140px] bg-background/70">
                      Explore Clubs
                    </Button>
                  </Link>
                </div>
              </div>

              {error ? (
                <div className="mx-auto mt-4 flex max-w-2xl items-center justify-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Live metrics are temporarily unavailable. Core app actions still work.
                </div>
              ) : null}

              <div className="mt-10">
                <ClubTicker clubs={data.clubs} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b">
          <div className="container py-12">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Step 1
                </div>
                <h3 className="mt-2 text-base font-semibold">Join or Create a Club</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Invite members and set the shared prediction focus.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Step 2
                </div>
                <h3 className="mt-2 text-base font-semibold">Predict Together</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Participate on-chain and automatically follow predictions.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Step 3
                </div>
                <h3 className="mt-2 text-base font-semibold">Compete</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Track net gains and measure your performance against other clubs.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="container py-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Values
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  Built for coordinated conviction
                </h2>
                <p className="mt-4 text-base text-muted-foreground">
                  A club needs clarity on custody, execution, and incentives. The stack is built to
                  keep funds sovereign while making group decisions easy to act on.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheckIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Self-Custody</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Each member funds and maintains custody of their safe, with no on-chain
                        pooling.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#2E5CFF]/10 text-[#2E5CFF]">
                      <PolymarketIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Polymarket-Native</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Powered by Polymarket APIs with relayer execution.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <LockIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Zero Platform Fees</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Order execution and safe creation with zero gas and no platform fees.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center gap-3 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div>
            Built on{' '}
            <a
              href="https://polygon.technology/"
              target="_blank"
              rel="noreferrer"
              className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
            >
              Polygon
            </a>
            . Powered by prediction markets.
          </div>
          <a
            href="https://x.com/prediction_club"
            target="_blank"
            rel="noreferrer"
            aria-label="Prediction Club on X"
            className="inline-flex items-center justify-center rounded-full border border-transparent px-2 py-1 text-lg text-muted-foreground hover:border-border hover:text-foreground"
          >
            𝕏
          </a>
        </div>
      </footer>
    </div>
  );
}
