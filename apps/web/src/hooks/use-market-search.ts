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
  outcomes?: string[] | string;
  outcomePrices?: string[] | string;
  clobTokenIds?: string[] | string;
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

  const parseStringArray = useCallback((value: string | string[] | undefined) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const normalizeMarketItem = useCallback(
    (item: MarketItem): MarketItem => {
      const outcomes = parseStringArray(item.outcomes);
      const outcomePrices = parseStringArray(item.outcomePrices);
      const clobTokenIds = parseStringArray(item.clobTokenIds);
      const markets = Array.isArray(item.markets)
        ? item.markets.map((market) => normalizeMarketItem(market))
        : undefined;

      return {
        ...item,
        outcomes: outcomes ?? item.outcomes,
        outcomePrices: outcomePrices ?? item.outcomePrices,
        clobTokenIds: clobTokenIds ?? item.clobTokenIds,
        markets,
      };
    },
    [parseStringArray]
  );

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

      const normalized = (response.data.items ?? []).map((item) => normalizeMarketItem(item));
      setResults(dedupeResults(normalized));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setSearching(false);
    }
  }, [apiFetch, dedupeResults, normalizeMarketItem, query]);

  const fetchMarketDetails = useCallback(
    async (market: MarketItem) => {
      const slug = market.slug?.trim();
      const id = market.id ? String(market.id) : undefined;
      if (!slug && !id) return null;

      const params = new URLSearchParams();
      if (slug) params.set('slug', slug);
      if (id) params.set('id', id);
      params.set('limit', '1');

      const response = await apiFetch<{
        success: boolean;
        data: { items: MarketItem[] };
      }>(`/api/markets?${params.toString()}`);

      if (!response.success) {
        throw new Error('Failed to fetch market details');
      }

      const item = response.data.items?.[0];
      return item ? normalizeMarketItem(item) : null;
    },
    [apiFetch, normalizeMarketItem]
  );

  return {
    query,
    setQuery,
    searching,
    error,
    results,
    runSearch,
    fetchMarketDetails,
  };
}
