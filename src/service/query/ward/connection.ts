'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptWardConnection,
  disconnectWardConnection,
  getWardActiveConnections,
  getWardConnections,
  getWardPendingConnectionRequests,
  refuseWardConnectionRequest,
} from '@/service/api/ward/connection';
import { removePendingConnectionRequest } from '@/lib/realtime/pendingConnectionRequests';

export const wardConnectionsQueryKey = ['ward-connections'] as const;
export const wardGuardianActiveConnectionsQueryKey = [...wardConnectionsQueryKey, 'active'] as const;
export const wardGuardianPendingConnectionsQueryKey = [...wardConnectionsQueryKey, 'pending'] as const;

export const wardConnectionsQueryOptions = queryOptions({
  queryKey: wardConnectionsQueryKey,
  queryFn: getWardConnections,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const wardGuardianActiveConnectionsQueryOptions = queryOptions({
  queryKey: wardGuardianActiveConnectionsQueryKey,
  queryFn: getWardActiveConnections,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const wardGuardianPendingConnectionsQueryOptions = queryOptions({
  queryKey: wardGuardianPendingConnectionsQueryKey,
  queryFn: getWardPendingConnectionRequests,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

interface WardConnectionMutationOptions {
  onError?: (error: unknown) => void;
  onMutate?: () => void;
  onSuccess?: () => void;
}

export function useWardGuardianActiveConnectionsQuery() {
  return useQuery(wardGuardianActiveConnectionsQueryOptions);
}

export function useWardGuardianPendingConnectionsQuery() {
  return useQuery(wardGuardianPendingConnectionsQueryOptions);
}

export function useWardConnectionAcceptMutation(options?: WardConnectionMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ward-connection-accept'],
    mutationFn: acceptWardConnection,
    onMutate: options?.onMutate,
    onSuccess: async (_data, connectionId) => {
      removePendingConnectionRequest(connectionId);
      options?.onSuccess?.();
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => options?.onError?.(error),
  });
}

export function useWardConnectionRefuseMutation(options?: WardConnectionMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ward-connection-refuse'],
    mutationFn: refuseWardConnectionRequest,
    onMutate: options?.onMutate,
    onSuccess: async (_data, connectionId) => {
      removePendingConnectionRequest(connectionId);
      options?.onSuccess?.();
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => options?.onError?.(error),
  });
}

export function useWardConnectionDisconnectMutation(options?: WardConnectionMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ward-connection-disconnect'],
    mutationFn: disconnectWardConnection,
    onMutate: options?.onMutate,
    onSuccess: async () => {
      options?.onSuccess?.();
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => options?.onError?.(error),
  });
}
