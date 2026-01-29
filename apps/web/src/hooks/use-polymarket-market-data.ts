import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

export type PolymarketOrderbook = {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  minOrderSize: string | null;
  tickSize: string | null;
  lastTradePrice: string | null;
  timestamp: string | null;
};

export type PolymarketMarketData = {
  tokenId: string;
  price: {
    buy: string | null;
    sell: string | null;
    midpoint: string | null;
  };
  orderbook: PolymarketOrderbook;
};

export function usePolymarketMarketData(tokenId?: string) {
  const { fetch } = useApi();
  const key = tokenId ? `/api/polymarket/market?tokenId=${encodeURIComponent(tokenId)}` : null;

  const { data, error, isLoading } = useSWR<ApiResponse<PolymarketMarketData>>(
    key,
    (url: string) => fetch<ApiResponse<PolymarketMarketData>>(url)
  );

  return {
    data: data?.data ?? null,
    error,
    isLoading,
  };
}
