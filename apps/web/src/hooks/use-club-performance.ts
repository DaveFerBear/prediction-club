import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';
import type { ClubPerformance } from '@/lib/performance';

export function useClubPerformance(slug?: string, days = 30) {
  const { fetch } = useApi();
  const key = slug ? `/api/clubs/${slug}/performance?days=${days}` : null;
  const { data, error, isLoading } = useSWR<ApiResponse<{ performance: ClubPerformance }>>(
    key,
    (url: string) => fetch<ApiResponse<{ performance: ClubPerformance }>>(url)
  );

  return {
    performance: data?.data?.performance ?? null,
    hasActivity: data?.data?.performance?.hasWindowActivity ?? false,
    isLoading,
    error,
  };
}
