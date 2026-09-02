'use client';

import { useQuery } from '@tanstack/react-query';

import { guardianConnectionsQueryOptions } from '@/service/query/guardian';

export default function useGuardianActiveWards() {
  const { data: connectionsResponse, isLoading, isError } = useQuery(guardianConnectionsQueryOptions);
  const activeWards = (connectionsResponse?.data ?? []).filter(connection => connection.status === 'ACTIVE');

  return { activeWards, hasActiveWards: activeWards.length > 0, isLoading, isError };
}
