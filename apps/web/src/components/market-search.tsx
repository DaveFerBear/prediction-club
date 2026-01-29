'use client';

import { Button, Card, CardContent, Input } from '@prediction-club/ui';
import { useMarketSearch, type MarketItem } from '@/hooks';

interface MarketSearchProps {
  selectedMarket: MarketItem | null;
  onSelect: (market: MarketItem) => void;
}

function getMarketKey(market: MarketItem) {
  return String(market.id ?? market.slug ?? market.eventId ?? '');
}

function getMarketTitle(market: MarketItem) {
  return market.question || market.title || market.slug || 'Market';
}

function getMarketUrl(market: MarketItem) {
  if (market.url) return market.url;
  if (market.slug) return `https://polymarket.com/market/${market.slug}`;
  return '';
}

function getMarketImage(market: MarketItem) {
  return market.image || market.image_url || market.icon || '';
}

export function MarketSearch({ selectedMarket, onSelect }: MarketSearchProps) {
  const { query, setQuery, searching, error, results, runSearch } = useMarketSearch();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
        className="space-y-2"
      >
        <label className="text-sm font-medium">Search markets</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Polymarket markets"
          />
          <Button type="submit" variant="outline" disabled={searching || !query.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && (
        <div className="max-h-96 overflow-y-auto rounded-md border border-border/60 p-2">
          <div className="grid gap-2 md:grid-cols-2">
            {results.map((market) => {
              const key = getMarketKey(market);
              const isSelected =
                selectedMarket && getMarketKey(selectedMarket) === key;
              const url = getMarketUrl(market);
              const image = getMarketImage(market);
              return (
                <button
                  key={key}
                  type="button"
                  className={`rounded-md border p-3 text-left transition ${
                    isSelected ? 'border-primary' : 'border-border'
                  }`}
                  onClick={() => onSelect(market)}
                >
                  <div className="flex items-start gap-3">
                    {image && (
                      <img
                        src={image}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground truncate">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {url}
                          </a>
                        ) : (
                          <span className="italic">No link</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {getMarketTitle(market)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {results.length === 0 && query.trim() && !searching && !error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No markets found.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
