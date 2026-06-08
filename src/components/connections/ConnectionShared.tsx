'use client';

import { ReactNode } from 'react';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { formatPhoneNumber } from '@/lib/format/phone';
import { IConnectionItem } from '@/service/interface/connection';
import styles from './ConnectionShared.module.css';

export { UserAvatar };

const cx = classNames.bind(styles);

export function getConnectionData(response: unknown) {
  if (Array.isArray(response)) return response as IConnectionItem[];

  const data = (response as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) return data as IConnectionItem[];

  const nestedData = (data as { data?: unknown } | undefined)?.data;
  return Array.isArray(nestedData) ? (nestedData as IConnectionItem[]) : [];
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

function getConnectionAddress(connection: IConnectionItem) {
  return [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
}

export function formatPartnerGender(value?: IConnectionItem['partnerGender'] | null) {
  if (value === 'FEMALE') return '여성';
  if (value === 'MALE') return '남성';
  return null;
}

export function getActivePartnerValue(connection: IConnectionItem, value?: string | null) {
  if (connection.status !== 'ACTIVE') return '연결 후 공개';
  return value || '정보 없음';
}

export function getPartnerPhoneValue(connection: IConnectionItem) {
  if (!connection.partnerPhone) return connection.status === 'ACTIVE' ? '정보 없음' : '연결 후 공개';
  if (connection.status !== 'ACTIVE') return connection.partnerPhone;
  return formatPhoneNumber(connection.partnerPhone);
}

function ConnectionDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={cx('connectionDetailItem')}>
      <span>{label}</span>
      <strong>{value || '정보 없음'}</strong>
    </div>
  );
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
  role,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel,
}: {
  connection: IConnectionItem;
  isPending: boolean;
  role: 'guardian' | 'ward';
  primaryAction?: () => void;
  primaryLabel?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}) {
  const address = connection.status === 'ACTIVE' ? getConnectionAddress(connection) : '';
  const dateLabel = connection.status === 'ACTIVE' ? '연결일' : '요청일';
  const dateValue = connection.status === 'ACTIVE' ? formatDate(connection.connectedAt) : formatDate(connection.createdAt);

  return (
    <li className={cx('connectionCard')} data-role={role}>
      <div className={cx('connectionCardMain')}>
        <UserAvatar size="w-60" imageUrl={connection.partnerProfileImage} />
        <div className={cx('connectionInfo')}>
          <div className={cx('connectionTitleRow')}>
            <div className={cx('connectionNameBlock')}>
              <strong>{connection.partnerName || '이름 확인 전'}</strong>
              <span>ID {connection.partnerUserId}</span>
            </div>
            <span className={cx('connectionStatus', getConnectionStatusClass(connection.status))}>
              {getConnectionStatusLabel(connection.status)}
            </span>
          </div>

          <div className={cx('connectionSummaryRow')}>
            {connection.relation && <span>{connection.relation}</span>}
            <span>{dateValue}</span>
          </div>

          <div className={cx('connectionDetailGrid')}>
            <ConnectionDetail label="이메일" value={getActivePartnerValue(connection, connection.partnerEmail)} />
            <ConnectionDetail label="성별" value={getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender))} />
            <ConnectionDetail label="생년월일" value={getActivePartnerValue(connection, connection.partnerBirthDate)} />
            <ConnectionDetail label="연락처" value={getPartnerPhoneValue(connection)} />
            <ConnectionDetail label={dateLabel} value={dateValue} />
            <ConnectionDetail label="우편번호" value={getActivePartnerValue(connection, connection.partnerPostcode)} />
            <ConnectionDetail label="주소" value={getActivePartnerValue(connection, address)} />
          </div>
        </div>
      </div>
      {primaryAction && primaryLabel ? (
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
      ) : null}
    </li>
  );
}
