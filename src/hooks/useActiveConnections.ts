'use client';

import { useQuery } from '@tanstack/react-query';

import { guardianConnectionsQueryOptions } from '@/service/query/guardian';
import { wardConnectionsQueryOptions } from '@/service/query/ward';

export function useGuardianActiveWards() {
  const { data: connectionsResponse, isLoading, isError } = useQuery(guardianConnectionsQueryOptions);
  const activeWards = (connectionsResponse?.data ?? []).filter(connection => connection.status === 'ACTIVE');

  return { activeWards, hasActiveWards: activeWards.length > 0, isLoading, isError };
}

export function useWardActiveGuardians() {
  const { data: connectionsResponse, isLoading, isError } = useQuery(wardConnectionsQueryOptions);
  const activeGuardians = (connectionsResponse?.data ?? []).filter(connection => connection.status === 'ACTIVE');

  return { activeGuardians, hasActiveGuardians: activeGuardians.length > 0, isLoading, isError };
}
