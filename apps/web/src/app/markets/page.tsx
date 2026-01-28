'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Badge } from '@prediction-club/ui';
import { Header } from '@/components/header';

type MarketItem = {
  id?: string | number;
  slug?: string;
  question?: string;
  title?: string;
  description?: string;
  liquidity?: number;
  volume?: number;
  volume24h?: number;
  startDate?: string;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  outcomes?: string[];
  outcomePrices?: string[];
  eventId?: string | number;
};

type MarketsResponse = {
  success: boolean;
  data: {
    mode: 'markets' | 'search';
    items: MarketItem[];
    pagination: {
      limit?: number;
      offset?: number;
      nextOffset?: number;
    } | null;
  };
};

function formatNumber(value?: number) {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function MarketsPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveQuery = useMemo(() => submittedQuery.trim(), [submittedQuery]);

  useEffect(() => {
    let cancelled = false;
    async function fetchMarkets() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (effectiveQuery) {
          params.set('q', effectiveQuery);
          params.set('limit', '50');
        } else {
          params.set('limit', '50');
          params.set('offset', '0');
          params.set('closed', 'false');
        }

        const res = await fetch(`/api/markets?${params.toString()}`);
        const data: MarketsResponse = await res.json();
        if (!data.success) {
          throw new Error('Failed to load markets');
        }
        if (!cancelled) {
          setItems(data.data.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load markets');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMarkets();
    return () => {
      cancelled = true;
    };
  }, [effectiveQuery]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-muted-foreground">Search Polymarket via the Gamma API.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search</CardTitle>
            <CardDescription>Find markets by keyword.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Search markets (e.g. election, bitcoin, fed)"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit">Search</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuery('');
                    setSubmittedQuery('');
                  }}
                >
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-muted-foreground">Loading markets...</div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No markets found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item, idx) => (
              <Card key={item.id ?? item.slug ?? item.eventId ?? idx}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">
                      {item.question || item.title || item.slug || 'Untitled market'}
                    </CardTitle>
                    <Badge variant={item.closed ? 'secondary' : 'default'}>
                      {item.closed ? 'Closed' : 'Open'}
                    </Badge>
                  </div>
                  {item.description && (
                    <CardDescription className="line-clamp-2">{item.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Liquidity</span>
                    <span>{formatNumber(item.liquidity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume</span>
                    <span>{formatNumber(item.volume)}</span>
                  </div>
                  {Array.isArray(item.outcomes) && Array.isArray(item.outcomePrices) && (
                    <div className="pt-2">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide">
                        Outcomes
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.outcomes.map((outcome, outcomeIdx) => (
                          <Badge key={`${outcome}-${outcomeIdx}`} variant="outline">
                            {outcome}: {item.outcomePrices?.[outcomeIdx] ?? '—'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
