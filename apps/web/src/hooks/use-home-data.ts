import useSWR from 'swr';
import type { ApiResponse } from '@prediction-club/shared';
import { useApi } from './use-api';

export type HomeClubItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdByUserId: string | null;
  allTimeCommittedVolume: string;
  performance: {
    days: number;
    navStart: string;
    navEnd: string;
    netFlows: string;
    simpleReturn: number;
    hasWindowActivity: boolean;
    realizedPnl: string;
  } | null;
  _count: {
    members: number;
    predictionRounds: number;
  };
};

export type HomeDataPayload = {
  kpis: {
    totalAllTimeVolume: string;
    medianSimpleReturn30d: number | null;
    publicClubCount: number;
  };
  clubs: HomeClubItem[];
  generatedAt: string;
};

const defaultHomeData: HomeDataPayload = {
  kpis: {
    totalAllTimeVolume: '0',
    medianSimpleReturn30d: null,
    publicClubCount: 0,
  },
  clubs: [],
  generatedAt: '',
};

export function useHomeData() {
  const { fetch } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<HomeDataPayload>>(
    '/api/home',
    (url: string) => fetch<ApiResponse<HomeDataPayload>>(url),
    {
      refreshInterval: 30_000,
    }
  );

  if (data && !data.success) {
    return {
      data: defaultHomeData,
      isLoading,
      error: new Error(data.error?.message || 'Failed to load homepage data'),
    };
  }

  return {
    data: data?.data ?? defaultHomeData,
    isLoading,
    error,
  };
}
