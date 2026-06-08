'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { RefreshButton } from '@/components/RefreshButton';
import {
  acceptWardConnection,
  disconnectWardConnection,
  getWardActiveConnections,
  getWardPendingConnectionRequests,
  refuseWardConnectionRequest,
} from '@/service/api/connect/ward';
import { wardConnectionsQueryKey } from '@/service/query/connection';
import {
  getPendingConnectionRequestItems,
  PENDING_CONNECTION_REQUESTS_EVENT,
  removePendingConnectionRequest,
} from '@/lib/realtime/pendingConnectionRequests';
import classNames from 'classnames/bind';
import {
  ConnectionCard,
  EmptyState,
  getConnectionData,
  getErrorMessage,
} from './ConnectionShared';
import styles from './WardGuardiansPanel.module.css';

const cx = classNames.bind(styles);
const wardActiveConnectionsQueryKey = [...wardConnectionsQueryKey, 'active'] as const;
const wardPendingConnectionsQueryKey = [...wardConnectionsQueryKey, 'pending'] as const;

export function WardGuardiansPanel() {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [storedPendingConnections, setStoredPendingConnections] = useState(() => getPendingConnectionRequestItems());
  const activeQuery = useQuery({
    queryKey: wardActiveConnectionsQueryKey,
    queryFn: getWardActiveConnections,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 10 * 1000,
    retry: false,
  });
  const pendingQuery = useQuery({
    queryKey: wardPendingConnectionsQueryKey,
    queryFn: getWardPendingConnectionRequests,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 10 * 1000,
    retry: false,
  });

  const activeConnections = getConnectionData(activeQuery.data);
  const apiPendingConnections = getWardPendingConnectionData(pendingQuery.data);
  const pendingConnections = mergePendingConnections(
    apiPendingConnections.map(mapWardPendingRequestToConnection),
    storedPendingConnections,
  );
  const isRefreshing = activeQuery.isLoading || pendingQuery.isLoading;
  const isError = activeQuery.isError && pendingQuery.isError;

  useEffect(() => {
    const syncStoredPendingConnections = () => setStoredPendingConnections(getPendingConnectionRequestItems());

    window.addEventListener(PENDING_CONNECTION_REQUESTS_EVENT, syncStoredPendingConnections);
    return () => window.removeEventListener(PENDING_CONNECTION_REQUESTS_EVENT, syncStoredPendingConnections);
  }, []);

  const acceptMutation = useMutation({
    mutationKey: ['ward-connection-accept'],
    mutationFn: acceptWardConnection,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async (_data, connectionId) => {
      removePendingConnectionRequest(connectionId);
      setFeedbackMessage('보호자 연결 요청을 수락했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '보호자 요청 수락에 실패했습니다.')),
  });

  const refuseMutation = useMutation({
    mutationKey: ['ward-connection-refuse'],
    mutationFn: refuseWardConnectionRequest,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async (_data, connectionId) => {
      removePendingConnectionRequest(connectionId);
      setFeedbackMessage('보호자 연결 요청을 거절했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '보호자 요청 거절에 실패했습니다.')),
  });

  const disconnectMutation = useMutation({
    mutationKey: ['ward-connection-disconnect'],
    mutationFn: disconnectWardConnection,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setFeedbackMessage('보호자 연결을 해제했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '보호자 연결 해제에 실패했습니다.')),
  });

  const isPending = acceptMutation.isPending || refuseMutation.isPending || disconnectMutation.isPending;
  const handleDisconnect = (connectionId: number) => {
    if (!window.confirm('이 보호자와의 연결을 해제할까요?')) return;
    disconnectMutation.mutate(connectionId);
  };

  return (
    <section className={cx('connectionPage')}>
      <div className={cx('connectionPageActions')}>
        <RefreshButton ariaLabel="보호자 목록 새로고침" disabled={isRefreshing} onRefresh={() => Promise.all([activeQuery.refetch(), pendingQuery.refetch()])} />
      </div>

      {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
      {isError && <EmptyState message="내 보호자 목록을 불러오지 못했습니다." />}

      <section className={cx('connectionSection')}>
        <div className={cx('connectionSectionHeader')}>
          <h3>내 보호자 리스트</h3>
          <span>{activeConnections.length}건</span>
        </div>
        {activeQuery.isError ? (
          <EmptyState message="내 보호자 목록을 불러오지 못했습니다." />
        ) : activeConnections.length > 0 ? (
          <ul className={cx('connectionList')}>
            {activeConnections.map(connection => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                isPending={isPending}
                role="ward"
                primaryAction={() => handleDisconnect(connection.id)}
                primaryLabel="연결 해제"
              />
            ))}
          </ul>
        ) : (
          !activeQuery.isLoading && <EmptyState message="연결된 보호자가 없습니다." />
        )}
      </section>

      <section className={cx('connectionSection')}>
        <div className={cx('connectionSectionHeader')}>
          <h3>요청온 목록</h3>
          <span>{pendingConnections.length}건</span>
        </div>
        {pendingQuery.isError ? (
          <EmptyState message="요청온 목록을 불러오지 못했습니다." />
        ) : pendingConnections.length > 0 ? (
          <ul className={cx('connectionList')}>
            {pendingConnections.map(connection => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                isPending={isPending}
                role="ward"
                primaryAction={() => acceptMutation.mutate(connection.id)}
                primaryLabel="수락"
                secondaryAction={() => refuseMutation.mutate(connection.id)}
                secondaryLabel="거절"
              />
            ))}
          </ul>
        ) : (
          !pendingQuery.isLoading && <EmptyState message="수락 또는 거절하지 않은 연결 요청이 없습니다." />
        )}
      </section>
    </section>
  );
}

function getWardPendingConnectionData(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) return data;

  const nestedData = (data as { data?: unknown } | undefined)?.data;
  return Array.isArray(nestedData) ? nestedData : [];
}

function mergePendingConnections(...connectionGroups: ReturnType<typeof getConnectionData>[]) {
  const pendingConnectionMap = new Map<number, ReturnType<typeof getConnectionData>[number]>();

  connectionGroups.flat().forEach(connection => {
    pendingConnectionMap.set(connection.id, connection);
  });

  return Array.from(pendingConnectionMap.values());
}

function mapWardPendingRequestToConnection(request: {
  connectionId: number;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  relation: string;
  requestedAt: string;
}) {
  return {
    connectedAt: null,
    createdAt: request.requestedAt,
    id: request.connectionId,
    partnerAddress: null,
    partnerAddressDetail: null,
    partnerBirthDate: null,
    partnerEmail: null,
    partnerGender: null,
    partnerName: request.guardianName,
    partnerPhone: request.guardianPhone,
    partnerPostcode: null,
    partnerProfileImage: null,
    partnerUserId: request.guardianId,
    relation: request.relation,
    requester: false,
    status: 'PENDING',
  } as const;
}
