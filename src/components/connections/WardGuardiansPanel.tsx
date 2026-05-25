'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { RefreshButton } from '@/components/RefreshButton';
import { acceptWardConnection, disconnectWardConnection, refuseWardConnectionRequest } from '@/service/api/connect/ward';
import { wardConnectionsQueryKey, wardConnectionsQueryOptions } from '@/service/query/connection';
import {
  getPendingConnectionRequestItems,
  PENDING_CONNECTION_REQUESTS_EVENT,
  removePendingConnectionRequest,
} from '@/lib/realtime/pendingConnectionRequests';
import {
  ConnectionCard,
  cx,
  EmptyState,
  getConnectionData,
  getErrorMessage,
  splitConnections,
} from './ConnectionShared';

export function WardGuardiansPanel() {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [storedPendingConnections, setStoredPendingConnections] = useState(() => getPendingConnectionRequestItems());
  const { data, isFetching, isLoading, isError, refetch } = useQuery(wardConnectionsQueryOptions);
  const connections = getConnectionData(data);
  const { activeConnections, pendingConnections: apiPendingConnections } = splitConnections(connections);
  const pendingConnections = mergePendingConnections(apiPendingConnections, storedPendingConnections);

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
        <RefreshButton isRefreshing={isFetching} ariaLabel="보호자 목록 새로고침" onRefresh={() => void refetch()} />
      </div>

      {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
      {isLoading && <EmptyState message="내 보호자 목록을 불러오는 중입니다." />}
      {isError && <EmptyState message="내 보호자 목록을 불러오지 못했습니다." />}

      {!isLoading && !isError && (
        <>
          <section className={cx('connectionSection')}>
            <div className={cx('connectionSectionHeader')}>
              <h3>내 보호자 리스트</h3>
              <span>{activeConnections.length}건</span>
            </div>
            {activeConnections.length > 0 ? (
              <ul className={cx('connectionList')}>
                {activeConnections.map(connection => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    isPending={isPending}
                    primaryAction={() => handleDisconnect(connection.id)}
                    primaryLabel="연결 해제"
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="연결된 보호자가 없습니다." />
            )}
          </section>

          <section className={cx('connectionSection')}>
            <div className={cx('connectionSectionHeader')}>
              <h3>요청온 목록</h3>
              <span>{pendingConnections.length}건</span>
            </div>
            {pendingConnections.length > 0 ? (
              <ul className={cx('connectionList')}>
                {pendingConnections.map(connection => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    isPending={isPending}
                    primaryAction={() => acceptMutation.mutate(connection.id)}
                    primaryLabel="수락"
                    secondaryAction={() => refuseMutation.mutate(connection.id)}
                    secondaryLabel="거절"
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="수락 또는 거절하지 않은 연결 요청이 없습니다." />
            )}
          </section>
        </>
      )}
    </section>
  );
}

function mergePendingConnections(...connectionGroups: ReturnType<typeof getConnectionData>[]) {
  const pendingConnectionMap = new Map<number, ReturnType<typeof getConnectionData>[number]>();

  connectionGroups.flat().forEach(connection => {
    pendingConnectionMap.set(connection.id, connection);
  });

  return Array.from(pendingConnectionMap.values());
}
