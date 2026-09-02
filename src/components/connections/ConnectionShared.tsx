'use client';

import classNames from 'classnames/bind';

import { formatPhoneNumber } from '@/lib/format/phone';
import { getConnectionItems, normalizeConnectionItem } from '@/lib/api/connectionResponse';
import { IConnectionItem } from '@/service/interface/connection';
import styles from './ConnectionShared.module.css';

const cx = classNames.bind(styles);

export function getConnectionData(response: unknown) {
  return getConnectionItems(response).map(normalizeConnectionItem);
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
