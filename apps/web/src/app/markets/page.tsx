'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { MarketCard } from '@/components/markets/market-card';
import { MarketDetailsPanel } from '@/components/markets/market-details-panel';
import { MarketCardSkeleton, MarketDetailsSkeleton } from '@/components/markets/market-skeletons';
import { getMarketIdentifier, getMarketTitle } from '@/components/markets/market-utils';
import { useClubs, useMarketsCatalog, type MarketItem } from '@/hooks';

function buildPredictHref(clubSlug: string, market: MarketItem) {
  const params = new URLSearchParams();
  if (market.slug) params.set('marketSlug', market.slug);
  if (market.id !== undefined && market.id !== null) params.set('marketId', String(market.id));
  if (market.conditionId) params.set('conditionId', market.conditionId);
  params.set('marketTitle', getMarketTitle(market));
  return `/clubs/${clubSlug}/predict?${params.toString()}`;
}

export default function MarketsPage() {
  const { query, setQuery, submitSearch, clearSearch, submittedQuery, markets, isLoading, error } =
    useMarketsCatalog();
  const { clubs, isLoading: isClubsLoading } = useClubs();
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

  useEffect(() => {
    if (markets.length === 0) {
      setSelectedMarketId(null);
      return;
    }

    const hasSelection = selectedMarketId
      ? markets.some((item) => getMarketIdentifier(item) === selectedMarketId)
      : false;

    if (!hasSelection) {
      setSelectedMarketId(getMarketIdentifier(markets[0]));
    }
  }, [markets, selectedMarketId]);

  const selectedMarket = useMemo(
    () => markets.find((item) => getMarketIdentifier(item) === selectedMarketId) ?? null,
    [markets, selectedMarketId]
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container space-y-6 py-8">
        <section className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/40 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge variant="outline" className="text-xs font-medium">
                Market Discovery
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Find the right market</h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Explore live Polymarket markets, inspect outcomes, and route directly into a club prediction flow.
              </p>
            </div>
            <Card className="w-full border-border/70 lg:max-w-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Search markets</CardTitle>
                <CardDescription>
                  Use keyword search or browse current open markets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitSearch();
                  }}
                >
                  <Input
                    value={query}
                    placeholder="bitcoin, election, fed..."
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <Button type="submit">Search</Button>
                  <Button type="button" variant="outline" onClick={clearSearch}>
                    Reset
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {submittedQuery ? `Search results for “${submittedQuery}”` : 'Open markets'}
              </h2>
              <Badge variant="outline">{markets.length} markets</Badge>
            </div>

            {isLoading ? (
              <div className="grid gap-3">
                <MarketCardSkeleton />
                <MarketCardSkeleton />
                <MarketCardSkeleton />
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">{error}</CardContent>
              </Card>
            ) : markets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No markets found. Try a different search term.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {markets.map((market) => {
                  const marketId = getMarketIdentifier(market);
                  return (
                    <MarketCard
                      key={marketId}
                      market={market}
                      selected={marketId === selectedMarketId}
                      onSelect={(item) => setSelectedMarketId(getMarketIdentifier(item))}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto md:pr-1">
            {isLoading ? (
              <MarketDetailsSkeleton />
            ) : (
              <MarketDetailsPanel
                market={selectedMarket}
                emptyLabel="Select any market on the left to inspect pricing and outcomes."
              />
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Use in club</CardTitle>
                <CardDescription>
                  Launch the prediction flow with this market pre-selected.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedMarket ? (
                  <p className="text-sm text-muted-foreground">Choose a market first.</p>
                ) : isClubsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : clubs.length === 0 ? (
                  <div className="space-y-3 rounded-md border border-dashed p-4">
                    <p className="text-sm text-muted-foreground">
                      You need a club before you can create a prediction.
                    </p>
                    <Button asChild>
                      <Link href="/clubs">Create or join a club</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clubs.slice(0, 6).map((club) => (
                      <div
                        key={club.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{club.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{club.slug}</p>
                        </div>
                        <Button asChild size="sm">
                          <Link href={buildPredictHref(club.slug, selectedMarket)}>Use in {club.name}</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
