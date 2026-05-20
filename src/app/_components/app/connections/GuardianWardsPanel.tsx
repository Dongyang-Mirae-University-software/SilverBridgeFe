'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelGuardianConnectionRequest, disconnectGuardianConnection } from '@/service/api/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/connection';
import {
  ConnectionCard,
  ConnectionSection,
  ConnectionStats,
  cx,
  EmptyState,
  getConnectionData,
  getErrorMessage,
  splitConnections,
} from './ConnectionShared';

export function GuardianWardsPanel() {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const { data, isFetching, isLoading, isError, refetch } = useQuery(guardianConnectionsQueryOptions);
  const connections = getConnectionData(data);
  const { activeConnections, pendingConnections } = splitConnections(connections);

  const cancelMutation = useMutation({
    mutationKey: ['guardian-connection-cancel'],
    mutationFn: cancelGuardianConnectionRequest,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setFeedbackMessage('연결 요청을 취소했습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '연결 요청 취소에 실패했습니다.')),
  });

  const disconnectMutation = useMutation({
    mutationKey: ['guardian-connection-disconnect'],
    mutationFn: disconnectGuardianConnection,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async () => {
      setFeedbackMessage('연결을 해제했습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setFeedbackMessage(getErrorMessage(error, '연결 해제에 실패했습니다.')),
  });

  const isPending = cancelMutation.isPending || disconnectMutation.isPending;
  const handleDisconnect = (connectionId: number) => {
    if (!window.confirm('이 피보호자와의 연결을 해제할까요?')) return;
    disconnectMutation.mutate(connectionId);
  };

  return (
    <section className={cx('connectionPage')}>
      <div className={cx('connectionHeader')}>
        <div className={cx('connectionHeaderTop')}>
          <span className={cx('eyebrow')}>피보호자 목록</span>
          <div className={cx('connectionHeaderActions')}>
            <button className={cx('connectionSecondaryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? '새로고침 중' : '새로고침'}
            </button>
            <Link className={cx('connectionLinkButton')} href="/guardian/wards/register">
              연결 요청
            </Link>
          </div>
        </div>
        <h2>연결된 피보호자와 대기 중인 요청을 관리하세요.</h2>
      </div>

      <ConnectionStats
        activeCount={activeConnections.length}
        pendingCount={pendingConnections.length}
        totalCount={connections.length}
      />

      {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
      {isLoading && <EmptyState message="피보호자 목록을 불러오는 중입니다." />}
      {isError && <EmptyState message="피보호자 목록을 불러오지 못했습니다." />}
      {!isLoading && !isError && connections.length === 0 && (
        <div className={cx('connectionEmptyBox')}>
          <EmptyState message="아직 연결된 피보호자가 없습니다." />
          <Link className={cx('connectionLinkButton')} href="/guardian/wards/register">
            피보호자 연결 요청하기
          </Link>
        </div>
      )}

      {connections.length > 0 && (
        <>
          <ConnectionSection title="연결된 피보호자" count={activeConnections.length}>
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
          </ConnectionSection>
          <ConnectionSection title="수락 대기 중" count={pendingConnections.length}>
            <ul className={cx('connectionList')}>
              {pendingConnections.map(connection => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  isPending={isPending}
                  primaryAction={() => cancelMutation.mutate(connection.id)}
                  primaryLabel="요청 취소"
                />
              ))}
            </ul>
          </ConnectionSection>
        </>
      )}
    </section>
  );
}
