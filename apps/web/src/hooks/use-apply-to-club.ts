import useSWRMutation from 'swr/mutation';
import { useSWRConfig } from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

type ApplyPayload = { message?: string };

type ApplyResponse = ApiResponse<{ success: boolean }>;

const clubKey = (slug: string) => `/api/clubs/${slug}`;

export function useApplyToClub(slug: string) {
  const { fetch, isAuthenticated } = useApi();
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<ApplyResponse, Error, string, ApplyPayload>(
    `/api/clubs/${slug}/apply`,
    (url: string, { arg }: { arg: ApplyPayload }) =>
      fetch<ApplyResponse>(url, {
        method: 'POST',
        body: JSON.stringify(arg ?? {}),
      })
  );

  const apply = async (message?: string) => {
    const response = await mutation.trigger({ message });
    if (response?.success) {
      // Refresh club data (e.g., application counts or membership visibility)
      await mutate(clubKey(slug));
    }
    return response;
  };

  return {
    apply,
    isAuthenticated,
    isApplying: mutation.isMutating,
    error: mutation.error,
  };
}
