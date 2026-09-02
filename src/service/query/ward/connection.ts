'use client';

import { createElement } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptWardConnection,
  disconnectWardConnection,
  getWardActiveConnections,
  getWardConnections,
  getWardPendingConnectionRequests,
  refuseWardConnectionRequest,
} from '@/service/api/ward/connection';
import { CommonModal } from '@/components/CommonModal';
import { removePendingConnectionRequest } from '@/lib/realtime/pendingConnectionRequests';
import useModalStore from '@/store/modalStore';

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
  errorMessage?: string;
  errorTitle?: string;
  successMessage?: string;
  successTitle?: string;
}

export function useWardGuardianActiveConnectionsQuery() {
  return useQuery(wardGuardianActiveConnectionsQueryOptions);
}

export function useWardGuardianPendingConnectionsQuery() {
  return useQuery(wardGuardianPendingConnectionsQueryOptions);
}

export function useWardConnectionAcceptMutation(options?: WardConnectionMutationOptions) {
  const queryClient = useQueryClient();
  const openFeedbackModal = useWardConnectionFeedbackModal();

  return useMutation({
    mutationKey: ['ward-connection-accept'],
    mutationFn: acceptWardConnection,
    onSuccess: async (_data, connectionId) => {
      removePendingConnectionRequest(connectionId);
      openFeedbackModal('success', options?.successTitle ?? '요청 수락 완료', options?.successMessage ?? '보호자 연결 요청을 수락했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => {
      openFeedbackModal(
        'error',
        options?.errorTitle ?? '요청 수락 실패',
        getWardConnectionErrorMessage(error, options?.errorMessage ?? '보호자 요청 수락에 실패했습니다.'),
      );
    },
  });
}

export function useWardConnectionRefuseMutation(options?: WardConnectionMutationOptions) {
  const queryClient = useQueryClient();
  const openFeedbackModal = useWardConnectionFeedbackModal();

  return useMutation({
    mutationKey: ['ward-connection-refuse'],
    mutationFn: refuseWardConnectionRequest,
    onSuccess: async (_data, connectionId) => {
      removePendingConnectionRequest(connectionId);
      openFeedbackModal('success', options?.successTitle ?? '요청 거절 완료', options?.successMessage ?? '보호자 연결 요청을 거절했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => {
      openFeedbackModal(
        'error',
        options?.errorTitle ?? '요청 거절 실패',
        getWardConnectionErrorMessage(error, options?.errorMessage ?? '보호자 요청 거절에 실패했습니다.'),
      );
    },
  });
}

export function useWardConnectionDisconnectMutation(options?: WardConnectionMutationOptions) {
  const queryClient = useQueryClient();
  const openFeedbackModal = useWardConnectionFeedbackModal();

  return useMutation({
    mutationKey: ['ward-connection-disconnect'],
    mutationFn: disconnectWardConnection,
    onSuccess: async () => {
      openFeedbackModal('success', options?.successTitle ?? '연결 해제 완료', options?.successMessage ?? '보호자 연결을 해제했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => {
      openFeedbackModal(
        'error',
        options?.errorTitle ?? '연결 해제 실패',
        getWardConnectionErrorMessage(error, options?.errorMessage ?? '보호자 연결 해제에 실패했습니다.'),
      );
    },
  });
}

function useWardConnectionFeedbackModal() {
  const openModal = useModalStore(state => state.openModal);
  const onCloseModal = useModalStore(state => state.onCloseModal);

  return (type: 'success' | 'error', title: string, message: string) => {
    openModal(
      createElement(CommonModal, {
        type,
        tone: 'guardian',
        title,
        message,
        confirmText: '확인',
        onConfirm: onCloseModal,
        onClose: onCloseModal,
      }),
    );
  };
}

function getWardConnectionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
