import { useAccount } from 'wagmi';
import { useCallback } from 'react';

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

/**
 * Hook that provides an authenticated fetch function
 * Automatically includes the wallet address in requests
 */
export function useApi() {
  const { address } = useAccount();

  const fetchWithAuth = useCallback(
    async <T>(url: string, options: FetchOptions = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (address) {
        headers['x-wallet-address'] = address;
      }

      const response = await fetch(url, {
        ...options,
        headers,
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
    [address]
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
