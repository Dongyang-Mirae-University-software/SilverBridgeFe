'use client';

import { useQuery } from '@tanstack/react-query';

import { wardConnectionsQueryOptions } from '@/service/query/ward';

export default function useWardActiveGuardians() {
  const { data: connectionsResponse, isLoading, isError } = useQuery(wardConnectionsQueryOptions);
  const activeGuardians = (connectionsResponse?.data ?? []).filter(connection => connection.status === 'ACTIVE');

  return { activeGuardians, hasActiveGuardians: activeGuardians.length > 0, isLoading, isError };
}
