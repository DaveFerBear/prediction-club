import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSWRConfig } from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

type ClubWalletPayload = {
  wallet: {
    id: string;
    walletAddress: string;
    isDisabled: boolean;
    createdAt: string;
    balance: string;
  } | null;
};

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

  return {
    wallet: query.data?.data?.wallet ?? null,
    isLoading: query.isLoading,
    error: query.error,
    initWallet,
    refreshWallet,
    isInitializing: initMutation.isMutating,
    initError: initMutation.error,
  };
}
