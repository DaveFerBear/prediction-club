import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';

type SessionUser = {
  id: string;
  email: string | null;
  walletAddress: string;
  turnkeySubOrgId: string | null;
  turnkeyEndUserId: string | null;
};

type SessionPayload = {
  authenticated: boolean;
  user: SessionUser | null;
};

async function fetchSession(url: string): Promise<ApiResponse<SessionPayload>> {
  const response = await fetch(url, {
    credentials: 'include',
  });
  const data = (await response.json()) as ApiResponse<SessionPayload>;
  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Failed to load auth session');
  }
  return data;
}

export function useAppSession() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<SessionPayload>>(
    '/api/auth/session',
    fetchSession
  );

  const authenticated = data?.data?.authenticated ?? false;
  const user = data?.data?.user ?? null;

  return {
    authenticated,
    user,
    isLoading,
    error,
    refreshSession: mutate,
  };
}

