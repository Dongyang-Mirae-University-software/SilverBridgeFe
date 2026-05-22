'use client';

import { ReactNode } from 'react';

import { cx } from '@/app/_common/layout/dashboard/styles';
import { IConnectionItem } from '@/service/interface/connection';

export { cx };

export function getConnectionData(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  return Array.isArray(data) ? (data as IConnectionItem[]) : [];
}

export function getErrorMessage(error: unknown, fallback: string) {
  return (error as Error).message || fallback;
}

export function getConnectionStatusLabel(status: IConnectionItem['status']) {
  switch (status) {
    case 'ACTIVE':
      return '연결됨';
    case 'CANCELLED':
      return '취소됨';
    case 'REFUSED':
      return '거절됨';
    case 'DISCONNECTED':
      return '연결 해제됨';
    default:
      return '수락 대기';
  }
}

export function getConnectionStatusClass(status: IConnectionItem['status']) {
  return {
    active: status === 'ACTIVE',
    cancelled: status === 'CANCELLED',
    disconnected: status === 'DISCONNECTED',
    refused: status === 'REFUSED',
  };
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

export function EmptyState({ message }: { message: string }) {
  return <p className={cx('connectionEmpty')}>{message}</p>;
}

export function ConnectionStats({
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

export function splitConnections(connections: IConnectionItem[]) {
  return {
    activeConnections: connections.filter(connection => connection.status === 'ACTIVE'),
    pendingConnections: connections.filter(connection => connection.status === 'PENDING'),
  };
}

export function ConnectionSection({
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

export function ConnectionCard({
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
          <span className={cx('connectionStatus', getConnectionStatusClass(connection.status))}>
            {getConnectionStatusLabel(connection.status)}
          </span>
        </div>
        <span className={cx('connectionMeta')}>ID {connection.partnerUserId}</span>
        {connection.relation && <span className={cx('connectionMeta')}>관계 {connection.relation}</span>}
        {connection.partnerPhone && <span className={cx('connectionMeta')}>연락처 {connection.partnerPhone}</span>}
        {connection.status === 'ACTIVE' && connection.partnerAddress && (
          <span className={cx('connectionMeta')}>
            주소 {[connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ')}
          </span>
        )}
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
