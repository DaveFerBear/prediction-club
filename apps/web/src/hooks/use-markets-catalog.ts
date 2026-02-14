import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useApi } from './use-api';
import { normalizeMarketItem, type RawMarketItem } from './use-market-search';

type MarketsListResponse = {
  success: boolean;
  data: {
    items: RawMarketItem[];
  };
};

export function useMarketsCatalog() {
  const { fetch } = useApi();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const effectiveQuery = submittedQuery.trim();

  const key = useMemo(() => {
    const params = new URLSearchParams();
    if (effectiveQuery) {
      params.set('q', effectiveQuery);
      params.set('limit', '50');
      return `/api/markets?${params.toString()}`;
    }
    params.set('limit', '50');
    params.set('offset', '0');
    params.set('closed', 'false');
    return `/api/markets?${params.toString()}`;
  }, [effectiveQuery]);

  const { data, error, isLoading, isValidating } = useSWR<MarketsListResponse>(
    key,
    (url: string) => fetch<MarketsListResponse>(url)
  );

  const markets = useMemo(() => {
    if (!data?.success) return [];
    return (data.data.items ?? []).map((item) => normalizeMarketItem(item));
  }, [data]);

  const submitSearch = useCallback(() => {
    setSubmittedQuery(query);
  }, [query]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSubmittedQuery('');
  }, []);

  return {
    query,
    setQuery,
    submittedQuery: effectiveQuery,
    markets,
    submitSearch,
    clearSearch,
    isLoading,
    isRefreshing: isValidating,
    error: error instanceof Error ? error.message : null,
  };
}
