import useSWRMutation from 'swr/mutation';
import { useSWRConfig } from 'swr';
import { useApi } from './use-api';
import type { ApiResponse, CreatePredictionRoundRequest } from '@prediction-club/shared';
import type { PredictionRound } from './use-club-queries';

type CreatePredictionResponse = ApiResponse<PredictionRound>;

export function useCreatePrediction(clubSlug: string) {
  const { fetch } = useApi();
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<
    CreatePredictionResponse,
    Error,
    string,
    CreatePredictionRoundRequest
  >(
    `/api/clubs/${clubSlug}/predictions`,
    (url: string, { arg }: { arg: CreatePredictionRoundRequest }) =>
      fetch<CreatePredictionResponse>(url, {
        method: 'POST',
        body: JSON.stringify(arg),
      })
  );

  const createPrediction = async (input: CreatePredictionRoundRequest) => {
    const response = await mutation.trigger(input);
    if (response?.success) {
      await mutate(`/api/clubs/${clubSlug}/predictions`);
    }
    return response;
  };

  return {
    createPrediction,
    isCreating: mutation.isMutating,
    error: mutation.error,
  };
}
