import Link from 'next/link';
import { Button } from '@prediction-club/ui';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Prediction Club</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Button>Connect Wallet</Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Trade Predictions Together
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Form prediction clubs, pool capital, and trade on Polymarket as a single on-chain
              actor. Powered by Gnosis Safe on Polygon.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button size="lg">Get Started</Button>
              </Link>
              <Link href="/clubs">
                <Button variant="outline" size="lg">
                  Explore Clubs
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/50">
          <div className="container py-24">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold">Pooled Capital</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Members deposit USDC into a shared vault. Track available vs committed balances
                  on-chain.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold">Cohort Trading</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create cohorts for each prediction. Automatic participation for eligible members.
                  Transparent PnL tracking.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold">Safe Multisig</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Each club is backed by a Gnosis Safe. Start 1-of-1, upgrade to 2-of-3 as you grow.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          Built on Polygon. Powered by prediction markets.
        </div>
      </footer>
    </div>
  );
}
