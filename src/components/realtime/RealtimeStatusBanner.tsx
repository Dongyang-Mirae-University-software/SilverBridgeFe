'use client';

import { useSyncExternalStore } from 'react';
import classNames from 'classnames/bind';

import { getRealtimeStatus, subscribeRealtimeStatus } from '@/lib/realtime/connectionSocket';
import styles from './RealtimeStatusBanner.module.css';

const cx = classNames.bind(styles);

// 실시간 연결(알림·SOS·복약 동기화)이 끊겼다가 다시 붙는 동안 화면 위에 알린다(QA AUTH-A54).
// 처음 붙기 전·정상일 때는 아무것도 그리지 않는다
export function RealtimeStatusBanner() {
  const status = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus, () => 'idle' as const);
  if (status !== 'reconnecting') return null;

  return (
    <p className={cx('banner')} role="status">
      실시간 연결이 끊겼어요. 다시 연결하는 중이에요.
    </p>
  );
}
