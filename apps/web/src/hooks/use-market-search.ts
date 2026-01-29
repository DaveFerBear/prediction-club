import { useCallback, useState } from 'react';
import { useApi } from './use-api';

export type MarketItem = {
  id?: string | number;
  eventId?: string | number;
  slug?: string;
  question?: string;
  title?: string;
  outcomes?: string[];
  markets?: MarketItem[];
  url?: string;
  image?: string;
  image_url?: string;
  icon?: string;
};

type GammaSearchItem = MarketItem;

function flattenGammaResults(items: GammaSearchItem[]) {
  const flattened: MarketItem[] = [];

  items.forEach((item) => {
    if (Array.isArray(item.markets) && item.markets.length > 0) {
      item.markets.forEach((market) => {
        flattened.push({
          ...market,
          eventId: item.eventId ?? market.eventId,
        });
      });
    } else {
      flattened.push(item);
    }
  });

  return flattened;
}

export function useMarketSearch() {
  const { fetch: apiFetch } = useApi();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MarketItem[]>([]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const response = await apiFetch<{
        success: boolean;
        data: { items: GammaSearchItem[] };
      }>(`/api/markets?q=${encodeURIComponent(trimmed)}`);

      if (!response.success) {
        throw new Error('Failed to fetch markets');
      }

      const flattened = flattenGammaResults(response.data.items ?? []);
      setResults(flattened);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setSearching(false);
    }
  }, [apiFetch, query]);

  return {
    query,
    setQuery,
    searching,
    error,
    results,
    runSearch,
  };
}
