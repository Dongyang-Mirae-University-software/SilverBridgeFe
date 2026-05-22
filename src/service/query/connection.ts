import { queryOptions } from '@tanstack/react-query';

import { getGuardianConnections } from '../api/guardianConnection';
import { getWardConnections } from '../api/wardConnection';

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
