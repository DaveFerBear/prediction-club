import useSWRMutation from 'swr/mutation';
import { useApi } from './use-api';
import type { ApiResponse, CreateClubRequest } from '@prediction-club/shared';

type CreateClubInput = Omit<CreateClubRequest, 'slug'> & { slug?: string };
type CreateClubResponse = ApiResponse<{ slug: string }>;

export function useCreateClub() {
  const { fetch } = useApi();

  const mutation = useSWRMutation<CreateClubResponse, Error, string, CreateClubInput>(
    '/api/clubs',
    (url: string, { arg }: { arg: CreateClubInput }) =>
      fetch<CreateClubResponse>(url, {
        method: 'POST',
        body: JSON.stringify({
          ...arg,
          slug: arg.slug || undefined,
        }),
      })
  );

  return {
    createClub: mutation.trigger,
    isCreating: mutation.isMutating,
    error: mutation.error,
  };
}
