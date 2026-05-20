'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelGuardianConnectionRequest, disconnectGuardianConnection } from '@/service/api/connection';
import { IConnectionItem } from '@/service/interface/connection';
import { guardianConnectionsQueryKey, guardianConnectionsQueryOptions } from '@/service/query/connection';
import {
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
  const sortedConnections = [...activeConnections, ...pendingConnections];

  const handleDisconnect = (connectionId: number) => {
    if (!window.confirm('이 피보호자와의 연결을 해제할까요?')) return;
    disconnectMutation.mutate(connectionId);
  };

  return (
    <section className={cx('connectionPage', 'wardListPage')}>
      <div className={cx('wardListToolbar')}>
        <div>
          <strong>현재 돌보고 있는 피보호자 {activeConnections.length}명</strong>
          <span>수락 대기 {pendingConnections.length}건</span>
        </div>
        <div className={cx('connectionHeaderActions')}>
          <button className={cx('connectionSecondaryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? '새로고침 중' : '새로고침'}
          </button>
          <Link className={cx('connectionLinkButton')} href="/guardian/wards/register">
            피보호자 등록
          </Link>
        </div>
      </div>

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
        <ul className={cx('wardListCards')}>
          {sortedConnections.map(connection => (
            <WardListCard
              key={connection.id}
              connection={connection}
              isPending={isPending}
              onCancel={() => cancelMutation.mutate(connection.id)}
              onDisconnect={() => handleDisconnect(connection.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function WardListCard({
  connection,
  isPending,
  onCancel,
  onDisconnect,
}: {
  connection: IConnectionItem;
  isPending: boolean;
  onCancel: () => void;
  onDisconnect: () => void;
}) {
  const isActive = connection.status === 'ACTIVE';
  const actionLabel = isActive ? '연결 해제' : '요청 취소';
  const actionHandler = isActive ? onDisconnect : onCancel;

  return (
    <li className={cx('wardListCard')}>
      <div className={cx('wardListCardHeader')}>
        <div className={cx('wardListAvatar')}>
          {connection.partnerProfileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={connection.partnerProfileImage} />
          ) : (
            connection.partnerName.charAt(0) || '?'
          )}
        </div>
        <div className={cx('wardListProfile')}>
          <div className={cx('wardListNameRow')}>
            <strong>{connection.partnerName || '이름 확인 전'}</strong>
            <span className={cx('connectionStatus', { active: isActive })}>{isActive ? '연결됨' : '수락 대기'}</span>
          </div>
          <span>{connection.partnerUserId}</span>
          <small>{isActive ? `연결일 ${formatWardListDate(connection.connectedAt)}` : `요청일 ${formatWardListDate(connection.createdAt)}`}</small>
        </div>
      </div>

      <div className={cx('wardListInfoGrid')}>
        <InfoRow label="회원 ID" value={connection.partnerUserId} />
        <InfoRow label="연결 상태" value={isActive ? 'ACTIVE' : 'PENDING'} />
        <InfoRow label="요청자" value={connection.requester ? '보호자' : '피보호자'} />
        <InfoRow label="우선순위" value={`${connection.priority ?? '-'}순위`} />
      </div>

      <div className={cx('wardListCardFooter')}>
        <button className={cx('wardListDangerButton')} type="button" disabled={isPending} onClick={actionHandler}>
          {actionLabel}
        </button>
      </div>
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={cx('wardListInfoRow')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatWardListDate(value: string | null) {
  if (!value) return '확인 전';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '확인 전';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
