import { useCallback, useState } from 'react';
import { useApi } from './use-api';

export type MarketItem = {
  id?: string | number;
  conditionId?: string;
  condition_id?: string;
  eventId?: string | number;
  slug?: string;
  question?: string;
  title?: string;
  subtitle?: string;
  outcomes?: string[];
  markets?: MarketItem[];
  url?: string;
  image?: string;
  image_url?: string;
  icon?: string;
};

export function useMarketSearch() {
  const { fetch: apiFetch } = useApi();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MarketItem[]>([]);

  const dedupeResults = useCallback((items: MarketItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key =
        item.id ??
        item.conditionId ??
        item.condition_id ??
        item.slug ??
        item.url ??
        item.eventId;
      if (!key) return true;
      const keyStr = String(key);
      if (seen.has(keyStr)) return false;
      seen.add(keyStr);
      return true;
    });
  }, []);

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
        data: { items: MarketItem[] };
      }>(`/api/markets?active=true&limit=50&q=${encodeURIComponent(trimmed)}`);

      if (!response.success) {
        throw new Error('Failed to fetch markets');
      }

      setResults(dedupeResults(response.data.items ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setSearching(false);
    }
  }, [apiFetch, dedupeResults, query]);

  return {
    query,
    setQuery,
    searching,
    error,
    results,
    runSearch,
  };
}
