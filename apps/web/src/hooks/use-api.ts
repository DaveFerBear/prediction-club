import { useCallback } from 'react';
import { useAppSession } from './use-app-session';

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

/**
 * Hook that provides an authenticated fetch function
 * Uses first-party app session cookies for auth
 */
export function useApi() {
  const { authenticated, user } = useAppSession();
  const address = user?.walletAddress ?? null;

  const fetchWithAuth = useCallback(
    async <T>(url: string, options: FetchOptions = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error?.code || 'UNKNOWN_ERROR',
          data.error?.message || 'An error occurred',
          response.status
        );
      }

      return data;
    },
    []
  );

  return {
    fetch: fetchWithAuth,
    isAuthenticated: authenticated,
    user,
    address,
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
