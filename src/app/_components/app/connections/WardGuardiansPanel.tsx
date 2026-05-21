'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acceptWardConnection, refuseWardConnectionRequest } from '@/service/api/connection';
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
  const { pendingConnections: apiPendingConnections } = splitConnections(connections);
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

  const isPending = acceptMutation.isPending || refuseMutation.isPending;

  return (
    <section className={cx('connectionPage')}>
      <div className={cx('connectionPageActions')}>
        <button className={cx('connectionSecondaryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? '새로고침 중' : '새로고침'}
        </button>
      </div>

      {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
      {isLoading && <EmptyState message="받은 연결 요청을 불러오는 중입니다." />}
      {isError && <EmptyState message="받은 연결 요청을 불러오지 못했습니다." />}

      {!isLoading && !isError && (
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
