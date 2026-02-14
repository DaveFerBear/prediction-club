import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useApi } from './use-api';

export type MarketItem = {
  id?: string | number;
  conditionId?: string;
  eventId?: string | number;
  slug?: string;
  question?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  liquidity?: number;
  volume?: number;
  volume24h?: number;
  closed?: boolean;
  active?: boolean;
  startDate?: string;
  endDate?: string;
  outcomes?: string[] | string;
  outcomePrices?: string[] | string;
  clobTokenIds?: string[] | string;
  markets?: MarketItem[];
  url?: string;
  image?: string;
  imageUrl?: string;
  icon?: string;
};

export type RawMarketItem = MarketItem & {
  condition_id?: string;
  image_url?: string;
};

export type MarketsApiResponse = {
  success: boolean;
  data: { items: RawMarketItem[] };
};

function parseStringArray(value: string | string[] | undefined) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeMarketItem(item: RawMarketItem): MarketItem {
  const { condition_id, image_url, ...rest } = item;
  const outcomes = parseStringArray(item.outcomes);
  const outcomePrices = parseStringArray(item.outcomePrices);
  const clobTokenIds = parseStringArray(item.clobTokenIds);
  const markets = Array.isArray(item.markets)
    ? item.markets.map((market) => normalizeMarketItem(market as RawMarketItem))
    : undefined;

  return {
    ...rest,
    conditionId: item.conditionId ?? condition_id,
    outcomes: outcomes ?? item.outcomes,
    outcomePrices: outcomePrices ?? item.outcomePrices,
    clobTokenIds: clobTokenIds ?? item.clobTokenIds,
    imageUrl: item.imageUrl ?? image_url,
    markets,
  };
}

function dedupeResults(items: MarketItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id ?? item.conditionId ?? item.slug ?? item.url ?? item.eventId;
    if (!key) return true;
    const keyStr = String(key);
    if (seen.has(keyStr)) return false;
    seen.add(keyStr);
    return true;
  });
}

async function fetchMarketDetailsRequest(
  apiFetch: <T>(url: string) => Promise<T>,
  market: MarketItem
) {
  const slug = market.slug?.trim();
  const id = market.id ? String(market.id) : undefined;
  if (!slug && !id) return null;

  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (id) params.set('id', id);
  params.set('limit', '1');

  const response = await apiFetch<MarketsApiResponse>(`/api/markets?${params.toString()}`);

  if (!response.success) {
    throw new Error('Failed to fetch market details');
  }

  const item = response.data.items?.[0];
  return item ? normalizeMarketItem(item) : null;
}

export function useMarketSearch() {
  const { fetch: apiFetch } = useApi();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const effectiveQuery = submittedQuery.trim();
  const key = effectiveQuery
    ? `/api/markets?active=true&limit=50&q=${encodeURIComponent(effectiveQuery)}`
    : null;

  const { data, error, isLoading, isValidating } = useSWR<MarketsApiResponse>(
    key,
    (url: string) => apiFetch<MarketsApiResponse>(url)
  );

  const runSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSubmittedQuery('');
      return;
    }
    setSubmittedQuery(trimmed);
  }, [query]);

  const results = useMemo(() => {
    if (!data?.success) return [];
    const normalized = (data.data.items ?? []).map((item) => normalizeMarketItem(item));
    return dedupeResults(normalized);
  }, [data]);

  const errorMessage = error instanceof Error ? error.message : null;

  return {
    query,
    setQuery,
    searching: isLoading || isValidating,
    error: errorMessage,
    results,
    runSearch,
  };
}

export function useMarketDetails() {
  const { fetch: apiFetch } = useApi();

  const fetchMarketDetails = useCallback(
    async (market: MarketItem) => fetchMarketDetailsRequest(apiFetch, market),
    [apiFetch]
  );

  return {
    fetchMarketDetails,
  };
}
