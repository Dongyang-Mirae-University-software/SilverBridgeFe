'use client';

import { FormEvent, ReactNode, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import {
  acceptWardConnection,
  cancelGuardianConnectionRequest,
  disconnectGuardianConnection,
  disconnectWardConnection,
  refuseWardConnectionRequest,
  requestWardConnection,
} from '@/service/api/connection';
import {
  guardianConnectionsQueryKey,
  guardianConnectionsQueryOptions,
  wardConnectionsQueryKey,
  wardConnectionsQueryOptions,
} from '@/service/query/connection';
import { IConnectionItem } from '@/service/interface/connection';
import styles from './UserDashboard.module.css';

const cx = classNames.bind(styles);

function getConnectionData(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  return Array.isArray(data) ? (data as IConnectionItem[]) : [];
}

function getErrorMessage(error: unknown, fallback: string) {
  return (error as Error).message || fallback;
}

function getStatusLabel(status: IConnectionItem['status']) {
  return status === 'ACTIVE' ? '연결됨' : '수락 대기';
}

function formatDate(value: string | null) {
  if (!value) return '미연결';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function EmptyState({ message }: { message: string }) {
  return <p className={cx('connectionEmpty')}>{message}</p>;
}

function ConnectionStats({
  activeCount,
  pendingCount,
  totalCount,
}: {
  activeCount: number;
  pendingCount: number;
  totalCount: number;
}) {
  return (
    <div className={cx('connectionStatGrid')}>
      <div className={cx('connectionStat')}>
        <span>전체 연결</span>
        <strong>{totalCount}건</strong>
        <small>현재 조회된 관계</small>
      </div>
      <div className={cx('connectionStat')}>
        <span>연결됨</span>
        <strong>{activeCount}건</strong>
        <small>ACTIVE 상태</small>
      </div>
      <div className={cx('connectionStat')}>
        <span>수락 대기</span>
        <strong>{pendingCount}건</strong>
        <small>PENDING 상태</small>
      </div>
    </div>
  );
}

function splitConnections(connections: IConnectionItem[]) {
  return {
    activeConnections: connections.filter(connection => connection.status === 'ACTIVE'),
    pendingConnections: connections.filter(connection => connection.status === 'PENDING'),
  };
}

function ConnectionSection({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  if (count === 0) return null;

  return (
    <div className={cx('connectionSection')}>
      <div className={cx('connectionSectionHeader')}>
        <h3>{title}</h3>
        <span>{count}건</span>
      </div>
      {children}
    </div>
  );
}

function ConnectionCard({
  connection,
  isPending,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel,
}: {
  connection: IConnectionItem;
  isPending: boolean;
  primaryAction: () => void;
  primaryLabel: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}) {
  return (
    <li className={cx('connectionCard')}>
      <div className={cx('connectionAvatar')}>
        {connection.partnerProfileImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={connection.partnerProfileImage} />
        ) : (
          connection.partnerName.charAt(0) || '?'
        )}
      </div>
      <div className={cx('connectionInfo')}>
        <div className={cx('connectionTitleRow')}>
          <strong>{connection.partnerName}</strong>
          <span className={cx('connectionStatus', { active: connection.status === 'ACTIVE' })}>
            {getStatusLabel(connection.status)}
          </span>
        </div>
        <span className={cx('connectionMeta')}>ID {connection.partnerUserId}</span>
        <span className={cx('connectionMeta')}>
          {connection.status === 'ACTIVE' ? `연결일 ${formatDate(connection.connectedAt)}` : `요청일 ${formatDate(connection.createdAt)}`}
        </span>
      </div>
      <div className={cx('connectionActions')}>
        <button className={cx('connectionPrimaryButton')} type="button" disabled={isPending} onClick={primaryAction}>
          {primaryLabel}
        </button>
        {secondaryAction && secondaryLabel ? (
          <button className={cx('connectionSecondaryButton')} type="button" disabled={isPending} onClick={secondaryAction}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function GuardianWardRegisterPanel() {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState('');

  const { mutate, isPending } = useMutation({
    mutationKey: ['guardian-connection-request'],
    mutationFn: requestWardConnection,
    onMutate: () => setMessage(''),
    onSuccess: async () => {
      setTargetId('');
      setMessage('피보호자에게 연결 요청을 보냈습니다.');
      await queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
    },
    onError: error => setMessage(getErrorMessage(error, '연결 요청에 실패했습니다.')),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTargetId = targetId.trim();
    if (!trimmedTargetId || isPending) return;
    mutate({ targetId: trimmedTargetId });
  };

  return (
    <section className={cx('connectionPage')}>
      <div className={cx('connectionHeader')}>
        <span className={cx('eyebrow')}>피보호자 연결</span>
        <h2>피보호자 ID로 연결 요청을 보내세요.</h2>
        <p>피보호자가 요청을 수락하면 보호자 대시보드에서 상태를 확인할 수 있습니다.</p>
      </div>

      <div className={cx('connectionRegisterGrid')}>
        <form className={cx('connectionFormCard')} onSubmit={handleSubmit}>
          <label className={cx('connectionField')}>
            <span>피보호자 ID</span>
            <input
              value={targetId}
              onChange={event => setTargetId(event.target.value)}
              placeholder="피보호자 ID를 입력하세요"
              maxLength={20}
              autoComplete="off"
            />
          </label>
          <button className={cx('connectionSubmitButton')} type="submit" disabled={!targetId.trim() || isPending}>
            {isPending ? '요청 중...' : '연결 요청'}
          </button>
        </form>

        <div className={cx('connectionGuideCard')}>
          <span className={cx('connectionStatus')}>안내</span>
          <strong>요청 후 피보호자 수락이 필요합니다.</strong>
          <p>요청이 전송되면 피보호자에게 알림이 전달되고, 수락 전까지 목록에서 수락 대기 상태로 표시됩니다.</p>
        </div>
      </div>

      {message && <p className={cx('connectionMessage')}>{message}</p>}

      <Link className={cx('connectionTextLink')} href="/guardian/wards">
        피보호자 목록에서 요청 상태 확인하기
      </Link>
    </section>
  );
}

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
      <div className={cx('connectionHeader')}>
        <div className={cx('connectionHeaderTop')}>
          <span className={cx('eyebrow')}>내 보호자</span>
          <button className={cx('connectionSecondaryButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? '새로고침 중' : '새로고침'}
          </button>
        </div>
        <h2>보호자 연결 요청을 수락하거나 연결을 해제할 수 있습니다.</h2>
      </div>

      <ConnectionStats
        activeCount={activeConnections.length}
        pendingCount={pendingConnections.length}
        totalCount={connections.length}
      />

      {feedbackMessage && <p className={cx('connectionMessage')}>{feedbackMessage}</p>}
      {isLoading && <EmptyState message="보호자 목록을 불러오는 중입니다." />}
      {isError && <EmptyState message="보호자 목록을 불러오지 못했습니다." />}
      {!isLoading && !isError && connections.length === 0 && <EmptyState message="아직 연결된 보호자가 없습니다." />}

      {connections.length > 0 && (
        <>
          <ConnectionSection title="연결된 보호자" count={activeConnections.length}>
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
          <ConnectionSection title="받은 연결 요청" count={pendingConnections.length}>
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
          </ConnectionSection>
        </>
      )}
    </section>
  );
}
