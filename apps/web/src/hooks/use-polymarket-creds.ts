import useSWRMutation from 'swr/mutation';
import { useApi } from './use-api';
import type { ApiResponse } from '@prediction-club/shared';

export interface SavePolymarketCredsInput {
  key: string;
  secret: string;
  passphrase: string;
  safeAddress?: string;
}

type SaveCredsResponse = ApiResponse<{ success: boolean }>;

export function usePolymarketCreds() {
  const { fetch } = useApi();

  const mutation = useSWRMutation<SaveCredsResponse, Error, string, SavePolymarketCredsInput>(
    '/api/polymarket/creds',
    (url: string, { arg }: { arg: SavePolymarketCredsInput }) =>
      fetch<SaveCredsResponse>(url, {
        method: 'POST',
        body: JSON.stringify(arg),
      })
  );

  return {
    saveCreds: mutation.trigger,
    isSaving: mutation.isMutating,
    error: mutation.error,
  };
}
