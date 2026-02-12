import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

export type LedgerHistoryItem = {
  id: string;
  type: string;
  amount: string;
  createdAt: string;
  asset: string;
};

type BalancePayload = {
  balance: string;
  history: LedgerHistoryItem[];
};

export function useClubBalance(slug?: string) {
  const { fetch } = useApi();
  const key = slug ? `/api/clubs/${slug}/balance` : null;
  const { data, error, isLoading } = useSWR<ApiResponse<BalancePayload>>(key, (url: string) =>
    fetch<ApiResponse<BalancePayload>>(url)
  );

  return {
    balance: data?.data?.balance ?? '0',
    history: data?.data?.history ?? [],
    isLoading,
    error,
  };
}
