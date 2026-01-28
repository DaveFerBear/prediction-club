import { useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

/**
 * Hook that provides an authenticated fetch function
 * Uses the NextAuth session cookie for auth
 */
export function useApi() {
  const { data: session } = useSession();
  const address = session?.address ?? null;

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
    isAuthenticated: !!address,
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
