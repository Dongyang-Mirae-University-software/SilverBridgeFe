'use client';

import { FormEvent, useState } from 'react';
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
  const data = (response as { data?: unknown }).data;
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
          connection.partnerName.charAt(0)
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
    <section className={cx('connectionPanel')}>
      <div className={cx('connectionHeader')}>
        <span className={cx('eyebrow')}>피보호자 연결</span>
        <h2>피보호자 ID로 연결 요청을 보내세요.</h2>
        <p>피보호자가 요청을 수락하면 보호자 대시보드에서 상태를 확인할 수 있습니다.</p>
      </div>

      <form className={cx('connectionForm')} onSubmit={handleSubmit}>
        <label className={cx('connectionField')}>
          <span>피보호자 ID</span>
          <input
            value={targetId}
            onChange={event => setTargetId(event.target.value)}
            placeholder="예: AB1234"
            maxLength={20}
            autoComplete="off"
          />
        </label>
        <button className={cx('connectionSubmitButton')} type="submit" disabled={!targetId.trim() || isPending}>
          {isPending ? '요청 중...' : '연결 요청'}
        </button>
      </form>

      {message && <p className={cx('connectionMessage')}>{message}</p>}
    </section>
  );
}

export function GuardianWardsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(guardianConnectionsQueryOptions);
  const connections = getConnectionData(data);

  const cancelMutation = useMutation({
    mutationKey: ['guardian-connection-cancel'],
    mutationFn: cancelGuardianConnectionRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey }),
  });

  const disconnectMutation = useMutation({
    mutationKey: ['guardian-connection-disconnect'],
    mutationFn: disconnectGuardianConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey }),
  });

  const isPending = cancelMutation.isPending || disconnectMutation.isPending;

  return (
    <section className={cx('connectionPanel')}>
      <div className={cx('connectionHeader')}>
        <span className={cx('eyebrow')}>피보호자 목록</span>
        <h2>연결된 피보호자와 대기 중인 요청을 관리하세요.</h2>
      </div>

      {isLoading && <EmptyState message="피보호자 목록을 불러오는 중입니다." />}
      {isError && <EmptyState message="피보호자 목록을 불러오지 못했습니다." />}
      {!isLoading && !isError && connections.length === 0 && <EmptyState message="아직 연결된 피보호자가 없습니다." />}

      {connections.length > 0 && (
        <ul className={cx('connectionList')}>
          {connections.map(connection => {
            const isActive = connection.status === 'ACTIVE';

            return (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                isPending={isPending}
                primaryAction={() =>
                  isActive ? disconnectMutation.mutate(connection.id) : cancelMutation.mutate(connection.id)
                }
                primaryLabel={isActive ? '연결 해제' : '요청 취소'}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function WardGuardiansPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(wardConnectionsQueryOptions);
  const connections = getConnectionData(data);

  const acceptMutation = useMutation({
    mutationKey: ['ward-connection-accept'],
    mutationFn: acceptWardConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey }),
  });

  const refuseMutation = useMutation({
    mutationKey: ['ward-connection-refuse'],
    mutationFn: refuseWardConnectionRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey }),
  });

  const disconnectMutation = useMutation({
    mutationKey: ['ward-connection-disconnect'],
    mutationFn: disconnectWardConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey }),
  });

  const isPending = acceptMutation.isPending || refuseMutation.isPending || disconnectMutation.isPending;

  return (
    <section className={cx('connectionPanel')}>
      <div className={cx('connectionHeader')}>
        <span className={cx('eyebrow')}>내 보호자</span>
        <h2>보호자 연결 요청을 수락하거나 연결을 해제할 수 있습니다.</h2>
      </div>

      {isLoading && <EmptyState message="보호자 목록을 불러오는 중입니다." />}
      {isError && <EmptyState message="보호자 목록을 불러오지 못했습니다." />}
      {!isLoading && !isError && connections.length === 0 && <EmptyState message="아직 연결된 보호자가 없습니다." />}

      {connections.length > 0 && (
        <ul className={cx('connectionList')}>
          {connections.map(connection => {
            const isActive = connection.status === 'ACTIVE';

            return (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                isPending={isPending}
                primaryAction={() =>
                  isActive ? disconnectMutation.mutate(connection.id) : acceptMutation.mutate(connection.id)
                }
                primaryLabel={isActive ? '연결 해제' : '수락'}
                secondaryAction={isActive ? undefined : () => refuseMutation.mutate(connection.id)}
                secondaryLabel={isActive ? undefined : '거절'}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
