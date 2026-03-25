import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

export type PriceHistoryPoint = { t: number; p: number };
export type PriceHistoryData = { history: PriceHistoryPoint[] };

export function usePolymarketPriceHistory(tokenId?: string, enabled = true) {
  const { fetch } = useApi();
  const key =
    tokenId && enabled
      ? `/api/polymarket/prices-history?tokenId=${encodeURIComponent(tokenId)}`
      : null;

  const { data, error, isLoading } = useSWR<ApiResponse<PriceHistoryData>>(
    key,
    (url: string) => fetch<ApiResponse<PriceHistoryData>>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    data: data?.data ?? null,
    error,
    isLoading,
  };
}
