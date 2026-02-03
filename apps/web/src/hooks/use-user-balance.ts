import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

type BalancePayload = {
  balance: string;
  history: Array<unknown>;
};

export function useUserBalance() {
  const { fetch, isAuthenticated } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<BalancePayload>>(
    isAuthenticated ? '/api/user/balance' : null,
    (url: string) => fetch<ApiResponse<BalancePayload>>(url)
  );

  return {
    balance: data?.data?.balance ?? '0',
    history: data?.data?.history ?? [],
    isLoading,
    error,
  };
}

