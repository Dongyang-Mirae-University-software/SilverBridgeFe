'use client';

import classNames from 'classnames/bind';

import { getConnectionItems, normalizeConnectionItem } from '@/utils/api/connectionResponse';
import { IConnectionItem } from '@/service/interface/connection';
import styles from './ConnectionShared.module.css';

const cx = classNames.bind(styles);

export function getConnectionData(response: unknown) {
  return getConnectionItems(response).map(normalizeConnectionItem);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return (error as Error).message || fallback;
}

export function formatPartnerGender(value?: IConnectionItem['partnerGender'] | null) {
  if (value === 'FEMALE') return '여성';
  if (value === 'MALE') return '남성';
  return null;
}

export function EmptyState({ message }: { message: string }) {
  return <p className={cx('connectionEmpty')}>{message}</p>;
}
