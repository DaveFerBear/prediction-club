import Link from 'next/link';
import { Button } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { PolymarketIcon } from '@/components/icons/polymarket-icon';
import { LockIcon } from '@/components/icons/lock-icon';
import { ShieldCheckIcon } from '@/components/icons/shield-check-icon';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:48px_48px] opacity-25" />
          </div>
          <Header variant="ghost" />
          <div className="container py-16 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Trade Predictions Together
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Create, discover, and join prediction clubs to trade on Polymarket together.
                Everyone keeps custody in their own Safe.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/clubs/create">
                  <Button size="lg" className="shadow-lg shadow-primary/20">
                    Start a Club
                  </Button>
                </Link>
                <Link href="/clubs">
                  <Button variant="outline" size="lg" className="shadow-sm">
                    Explore Clubs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-background">
          <div className="container py-12">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Step 1
                </div>
                <h3 className="mt-2 text-base font-semibold">Join or Create a Club</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Invite members and set the shared prediction focus.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Step 2
                </div>
                <h3 className="mt-2 text-base font-semibold">Predict Together</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Participate on-chain, or just join a club and automatically follow predictions.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Step 3
                </div>
                <h3 className="mt-2 text-base font-semibold">Compete</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Measure your performance with other clubs and track your net gains.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/50">
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
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheckIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Self-Custody First</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Each member funds and maintains custody of their safe, with no on-chain
                        pooling.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm">
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
                <div className="rounded-xl border bg-card p-6 shadow-sm">
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

      {/* Footer */}
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
