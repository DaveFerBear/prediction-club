import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSWRConfig } from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

type ClubWalletPayload = {
  wallet: {
    id: string;
    walletAddress: string;
    turnkeyWalletAccountId: string;
    isDisabled: boolean;
    automationReady: boolean;
    createdAt: string;
    balance: string;
  } | null;
};

export type ClubWalletSummary = NonNullable<ClubWalletPayload['wallet']>;

const clubWalletKey = (slug: string) => `/api/clubs/${slug}/wallet`;

export function useClubWallet(slug?: string) {
  const { fetch, isAuthenticated } = useApi();
  const { mutate } = useSWRConfig();

  const key = slug && isAuthenticated ? clubWalletKey(slug) : null;

  const query = useSWR<ApiResponse<ClubWalletPayload>>(key, (url: string) =>
    fetch<ApiResponse<ClubWalletPayload>>(url)
  );

  const initMutation = useSWRMutation<ApiResponse<ClubWalletPayload>, Error, string | null, void>(
    slug ? `/api/clubs/${slug}/wallet/init` : null,
    (url: string | null) => {
      if (!url) {
        throw new Error('Missing club slug');
      }
      return fetch<ApiResponse<ClubWalletPayload>>(url, {
        method: 'POST',
      });
    }
  );

  const enableTradingMutation = useSWRMutation<
    ApiResponse<{ wallet: ClubWalletSummary; txHashes: string[] }>,
    Error,
    string | null,
    void
  >(slug ? `/api/clubs/${slug}/wallet/enable-trading` : null, (url: string | null) => {
    if (!url) {
      throw new Error('Missing club slug');
    }
    return fetch<ApiResponse<{ wallet: ClubWalletSummary; txHashes: string[] }>>(url, {
      method: 'POST',
    });
  });

  const initWallet = async () => {
    if (!slug) {
      throw new Error('Missing club slug');
    }
    await initMutation.trigger();
    await mutate(clubWalletKey(slug));
  };

  const refreshWallet = async () => {
    if (!slug) return;
    await mutate(clubWalletKey(slug));
  };

  const enableTrading = async () => {
    if (!slug) {
      throw new Error('Missing club slug');
    }
    const response = await enableTradingMutation.trigger();
    await mutate(clubWalletKey(slug));
    return response.data.txHashes ?? [];
  };

  return {
    wallet: query.data?.data?.wallet ?? null,
    isLoading: query.isLoading,
    error: query.error,
    initWallet,
    enableTrading,
    refreshWallet,
    isInitializing: initMutation.isMutating,
    isEnablingTrading: enableTradingMutation.isMutating,
    initError: initMutation.error,
    enableTradingError: enableTradingMutation.error,
  };
}
