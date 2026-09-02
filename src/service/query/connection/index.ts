'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';

import { getGuardianConnections } from '@/service/api/connect/guardian';
import { getWardConnections } from '@/service/api/connect/ward';

export const guardianConnectionsQueryKey = ['guardian-connections'] as const;
export const wardConnectionsQueryKey = ['ward-connections'] as const;

export const guardianConnectionsQueryOptions = queryOptions({
  queryKey: guardianConnectionsQueryKey,
  queryFn: getGuardianConnections,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const wardConnectionsQueryOptions = queryOptions({
  queryKey: wardConnectionsQueryKey,
  queryFn: getWardConnections,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export function useGuardianActiveWards() {
  const { data: connectionsResponse, isLoading, isError } = useQuery(guardianConnectionsQueryOptions);
  const activeWards = (connectionsResponse?.data ?? []).filter(connection => connection.status === 'ACTIVE');

  return { activeWards, hasActiveWards: activeWards.length > 0, isLoading, isError };
}
