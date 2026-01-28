import Link from 'next/link';
import { Button } from '@prediction-club/ui';
import { Header } from '@/components/header';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <main className="flex-1">
        <section className="container py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Trade Predictions Together
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Form prediction clubs, pool capital, and trade on Polymarket together. Built on
              Polygon.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/clubs/create">
                <Button size="lg">Start a Club</Button>
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
                  Members fund their own Polymarket wallets and trade as a coordinated club.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold">Predictions</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create predictions for each market. Automatic participation for eligible members.
                  Transparent PnL tracking.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold">Gasless Execution</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Trades use Polymarket’s relayer, so users avoid gas fees while still signing
                  orders.
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
