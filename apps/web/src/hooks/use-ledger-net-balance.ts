import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

type NetBalancePayload = {
  balance: string;
};

export function useLedgerNetBalance() {
  const { fetch, isAuthenticated } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<NetBalancePayload>>(
    isAuthenticated ? '/api/ledger/net-balance' : null,
    (url: string) => fetch<ApiResponse<NetBalancePayload>>(url)
  );

  return {
    balance: data?.data?.balance ?? '0',
    isLoading,
    error,
  };
}
