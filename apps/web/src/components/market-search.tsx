'use client';

import { useState } from 'react';
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
  return market.question || market.title || market.subtitle || market.slug || 'Market';
}

function getMarketUrl(market: MarketItem) {
  if (market.url) return market.url;
  if (market.slug) return `https://polymarket.com/market/${market.slug}`;
  return '';
}

function getMarketImage(market: MarketItem) {
  return market.image || market.image_url || market.icon || '';
}

function formatUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
}

export function MarketSearch({ selectedMarket, onSelect }: MarketSearchProps) {
  const { query, setQuery, searching, error, results, runSearch, fetchMarketDetails } =
    useMarketSearch();
  const [loadingMarketKey, setLoadingMarketKey] = useState<string | null>(null);
  const eventResults = results.filter(
    (item) => Array.isArray(item.markets) && item.markets.length > 0
  );
  const marketResults = results.filter(
    (item) => !Array.isArray(item.markets) || item.markets.length === 0
  );

  const handleSelectMarket = async (market: MarketItem) => {
    const key = getMarketKey(market);
    setLoadingMarketKey(key);
    try {
      const detailed = await fetchMarketDetails(market);
      onSelect(detailed ?? market);
    } catch {
      onSelect(market);
    } finally {
      setLoadingMarketKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
        className="space-y-2"
      >
        <label className="text-sm font-medium">Search events</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Polymarket events"
          />
          <Button type="submit" variant="outline" disabled={searching || !query.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && (
        <div className="max-h-96 overflow-y-auto rounded-md border border-border/60 p-2">
          <div className="space-y-3">
            {eventResults.map((eventItem) => {
              const eventKey = getMarketKey(eventItem);
              const eventUrl = getMarketUrl(eventItem);
              const eventImage = getMarketImage(eventItem);
              return (
                <div key={eventKey} className="rounded-md border p-3">
                  <div className="flex items-start gap-3">
                    {eventImage && (
                      <img
                        src={eventImage}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {eventUrl ? (
                          <a
                            href={eventUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[220px] truncate text-xs text-muted-foreground underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {formatUrl(eventUrl)}
                          </a>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">No link</span>
                        )}
                        <div className="min-w-0 text-sm font-medium truncate">
                          {getMarketTitle(eventItem)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(eventItem.markets ?? []).map((market) => {
                      const key = getMarketKey(market);
                      const isSelected =
                        selectedMarket && getMarketKey(selectedMarket) === key;
                      const url = getMarketUrl(market);
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={loadingMarketKey === key}
                          aria-busy={loadingMarketKey === key}
                          className={`rounded-md border p-2 text-left text-sm transition ${
                            isSelected ? 'border-primary' : 'border-border'
                          }`}
                          onClick={() => handleSelectMarket(market)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {url ? (
                              <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                                {formatUrl(url)}
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">No link</span>
                            )}
                            <span className="min-w-0 font-medium truncate">
                              {getMarketTitle(market)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {marketResults.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {marketResults.map((market) => {
                  const key = getMarketKey(market);
                  const isSelected =
                    selectedMarket && getMarketKey(selectedMarket) === key;
                  const url = getMarketUrl(market);
                  const image = getMarketImage(market);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={loadingMarketKey === key}
                      aria-busy={loadingMarketKey === key}
                      className={`rounded-md border p-3 text-left transition ${
                        isSelected ? 'border-primary' : 'border-border'
                      }`}
                      onClick={() => handleSelectMarket(market)}
                    >
                      <div className="flex items-start gap-3">
                        {image && (
                          <img
                            src={image}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="max-w-[180px] truncate text-xs text-muted-foreground underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {formatUrl(url)}
                              </a>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">No link</span>
                            )}
                            <div className="min-w-0 text-sm font-medium truncate">
                              {getMarketTitle(market)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {results.length === 0 && query.trim() && !searching && !error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No events found.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
