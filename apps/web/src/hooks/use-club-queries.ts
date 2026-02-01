import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSWRConfig } from 'swr';
import { useState } from 'react';
import { useApi } from './use-api';
import type { ApiResponse } from '@prediction-club/shared';

export interface ClubListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  activeCommittedVolume: string;
  _count: {
    members: number;
    predictionRounds: number;
  };
}

export interface ClubDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  activeCommittedVolume: string;
  manager: {
    id: string;
    walletAddress: string;
    email: string | null;
  } | null;
  members: Array<{
    role: string;
    user: {
      id: string;
      walletAddress: string;
      email: string | null;
    };
  }>;
  predictionRounds: Array<{
    id: string;
    marketTitle: string | null;
    status: string;
    stakeTotal: string;
  }>;
  _count: {
    members: number;
    predictionRounds: number;
  };
}

export interface PredictionRound {
  id: string;
  marketTitle: string | null;
  marketRef: string | null;
  status: string;
  stakeTotal: string;
  _count: {
    members: number;
  };
}

export interface Application {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    walletAddress: string;
    email: string | null;
  };
}

type ClubsPayload = {
  items: ClubListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type PredictionRoundsPayload = {
  items: PredictionRound[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type ApplicationsPayload = {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export interface UpdateClubInput {
  name: string;
  description?: string | null;
  isPublic: boolean;
}

const clubsKey = (publicOnly: boolean) => (publicOnly ? '/api/clubs' : '/api/clubs?public=false');
const clubKey = (slug?: string) => (slug ? `/api/clubs/${slug}` : null);
const predictionRoundsKey = (slug?: string) => (slug ? `/api/clubs/${slug}/predictions` : null);
const applicationsKey = (slug?: string, status = 'PENDING') =>
  slug ? `/api/clubs/${slug}/applications?status=${status}` : null;

export function useClubs({ publicOnly = true }: { publicOnly?: boolean } = {}) {
  const { fetch } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<ClubsPayload>>(
    clubsKey(publicOnly),
    (url: string) => fetch<ApiResponse<ClubsPayload>>(url)
  );

  if (data && !data.success) {
    return {
      clubs: [],
      total: 0,
      isLoading,
      error: new Error(data.error?.message || 'Request failed'),
    };
  }

  return {
    clubs: data?.data?.items ?? [],
    total: data?.data?.total ?? 0,
    isLoading,
    error,
  };
}

export function useClub(slug?: string) {
  const { fetch } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<ClubDetail>>(clubKey(slug), (url: string) =>
    fetch<ApiResponse<ClubDetail>>(url)
  );

  if (data && !data.success) {
    return { club: null, isLoading, error: new Error(data.error?.message || 'Request failed') };
  }

  return { club: data?.data ?? null, isLoading, error };
}

export function usePredictionRounds(slug?: string) {
  const { fetch } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<PredictionRoundsPayload>>(
    predictionRoundsKey(slug),
    (url: string) => fetch<ApiResponse<PredictionRoundsPayload>>(url)
  );

  if (data && !data.success) {
    return {
      predictionRounds: [],
      isLoading,
      error: new Error(data.error?.message || 'Request failed'),
    };
  }

  return {
    predictionRounds: data?.data?.items ?? [],
    isLoading,
    error,
  };
}

export function useClubApplications(slug?: string, status = 'PENDING') {
  const { fetch } = useApi();
  const { data, error, isLoading } = useSWR<ApiResponse<ApplicationsPayload>>(
    applicationsKey(slug, status),
    (url: string) => fetch<ApiResponse<ApplicationsPayload>>(url)
  );

  if (data && !data.success) {
    return {
      applications: [],
      isLoading,
      error: new Error(data.error?.message || 'Request failed'),
    };
  }

  return {
    applications: data?.data?.items ?? [],
    isLoading,
    error,
  };
}

export function useApproveApplication(slug: string) {
  const { fetch } = useApi();
  const { mutate } = useSWRConfig();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const mutation = useSWRMutation<ApiResponse<{ success: boolean }>, Error, string, string>(
    `/api/clubs/${slug}/applications`,
    (url: string, { arg: applicationId }: { arg: string }) =>
      fetch<ApiResponse<{ success: boolean }>>(`${url}/${applicationId}/approve`, {
        method: 'POST',
      })
  );

  const approve = async (applicationId: string) => {
    setApprovingId(applicationId);
    try {
      const response = await mutation.trigger(applicationId);
      if (response?.success) {
        await Promise.all([mutate(clubKey(slug)), mutate(applicationsKey(slug))]);
      }
    } finally {
      setApprovingId(null);
    }
  };

  return {
    approve,
    approvingId,
    isApproving: mutation.isMutating,
    error: mutation.error,
  };
}

export function useUpdateClub(slug: string) {
  const { fetch } = useApi();
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<ApiResponse<ClubDetail>, Error, string, UpdateClubInput>(
    `/api/clubs/${slug}`,
    (url: string, { arg }: { arg: UpdateClubInput }) =>
      fetch<ApiResponse<ClubDetail>>(url, {
        method: 'PATCH',
        body: JSON.stringify(arg),
      })
  );

  const updateClub = async (input: UpdateClubInput) => {
    const response = await mutation.trigger(input);
    if (response?.success) {
      await Promise.all([mutate(clubKey(slug)), mutate(clubsKey(true)), mutate(clubsKey(false))]);
    }
    return response;
  };

  return {
    updateClub,
    isUpdating: mutation.isMutating,
    error: mutation.error,
  };
}
