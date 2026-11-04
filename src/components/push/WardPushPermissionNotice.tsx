'use client';

import { useState, useSyncExternalStore } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { reportNonApiError } from '@/lib/api/reportError';
import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import styles from './WardPushPermissionNotice.module.css';

const cx = classNames.bind(styles);

type PermissionState = NotificationPermission | 'unsupported';

function getPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// 주소창에서 권한을 바꾸면 Chrome은 permissions change를 보낸다. 지원하지 않는 브라우저는 창으로 돌아올 때 다시 읽는다
function subscribe(onChange: () => void) {
  let status: PermissionStatus | null = null;
  let disposed = false;
  void navigator.permissions
    ?.query({ name: 'notifications' })
    .then(result => {
      if (disposed) return;
      status = result;
      status.addEventListener('change', onChange);
    })
    .catch(() => {});
  window.addEventListener('focus', onChange);

  return () => {
    disposed = true;
    status?.removeEventListener('change', onChange);
    window.removeEventListener('focus', onChange);
  };
}

// 서버 렌더에서는 권한을 모르므로 안내를 그리지 않는다
function getServerPermission(): PermissionState {
  return 'granted';
}

// 피보호자의 "약 먹을 시간" 알림은 푸시로만 간다(문자 없음, 2026-11-04 BE #441).
// 이 기기에서 알림을 허용하지 않으면 받을 길이 없으니 허용을 안내한다
export function WardPushPermissionNotice() {
  const permission = useSyncExternalStore(subscribe, getPermission, getServerPermission);
  const [isRequesting, setIsRequesting] = useState(false);

  // 알림을 아예 못 쓰는 브라우저(홈 화면에 추가하지 않은 아이폰 등)는 누를 수 있는 게 없어 안내하지 않는다
  if (permission === 'granted' || permission === 'unsupported') return null;

  const handleAllow = async () => {
    setIsRequesting(true);
    try {
      await registerFcmTokenForCurrentDevice();
    } catch (error) {
      reportNonApiError('FCM 토큰 등록 실패:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <section className={cx('notice')} aria-labelledby="ward-push-permission-title">
      <Icon name="bell" size={30} decorative />
      <div className={cx('text')}>
        <strong id="ward-push-permission-title">약 먹을 시간 알림이 꺼져 있어요</strong>
        {permission === 'denied' ? (
          <p>주소창 왼쪽 자물쇠를 눌러 &lsquo;알림&rsquo;을 허용으로 바꿔 주세요. 그래야 약 먹을 시간에 알려 드려요.</p>
        ) : (
          <p>알림을 켜 두면 약 먹을 시간에 알려 드려요.</p>
        )}
      </div>
      {permission === 'default' && (
        <button className={cx('allowButton')} type="button" disabled={isRequesting} onClick={() => void handleAllow()}>
          알림 켜기
        </button>
      )}
    </section>
  );
}
