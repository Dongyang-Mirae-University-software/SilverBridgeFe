'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acceptWardConnection, disconnectWardConnection, refuseWardConnectionRequest } from '@/service/api/connection';
import { wardConnectionsQueryKey, wardConnectionsQueryOptions } from '@/service/query/connection';
import {
  ConnectionCard,
  ConnectionStats,
  cx,
  EmptyState,
  getConnectionData,
  getErrorMessage,
  splitConnections,
} from './ConnectionShared';

export function WardGuardiansPanel() {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const { data, isFetching, isLoading, isError, refetch } = useQuery(wardConnectionsQueryOptions);
  const connections = getConnectionData(data);
  const { activeConnections, pendingConnections } = splitConnections(connections);

  const acceptMutation = useMutation({
    mutationKey: ['ward-connection-accept'],
    mutationFn: acceptWardConnection,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setFeedbackMessage('보호자 연결 요청을 수락했습니다.');
      await queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '보호자 요청 수락에 실패했습니다.')),
  });

  const refuseMutation = useMutation({
    mutationKey: ['ward-connection-refuse'],
    mutationFn: refuseWardConnectionRequest,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
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
        <button className={cx('connectionSecondaryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? '새로고침 중' : '새로고침'}
        </button>
      </div>

      <ConnectionStats
        activeCount={activeConnections.length}
        pendingCount={pendingConnections.length}
        totalCount={connections.length}
      />

      {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
      {isLoading && <EmptyState message="보호자 목록을 불러오는 중입니다." />}
      {isError && <EmptyState message="보호자 목록을 불러오지 못했습니다." />}

      {!isLoading && !isError && (
        <>
          <section className={cx('connectionSection')}>
            <div className={cx('connectionSectionHeader')}>
              <h3>연결된 보호자</h3>
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
              <EmptyState message="아직 연결된 보호자가 없습니다." />
            )}
          </section>

          <section className={cx('connectionSection')}>
            <div className={cx('connectionSectionHeader')}>
              <h3>받은 연결 요청</h3>
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
              <EmptyState message="받은 연결 요청이 없습니다." />
            )}
          </section>
        </>
      )}
    </section>
  );
}
