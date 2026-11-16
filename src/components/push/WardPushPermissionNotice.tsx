'use client';

import { useState, useSyncExternalStore } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { reportNonApiError } from '@/lib/api/reportError';
import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import styles from './WardPushPermissionNotice.module.css';

const cx = classNames.bind(styles);

type PermissionState = NotificationPermission | 'unsupported';

export function getPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// 주소창에서 권한을 바꾸면 Chrome은 permissions change를 보낸다. 지원하지 않는 브라우저는 창으로 돌아올 때 다시 읽는다
export function subscribe(onChange: () => void) {
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
export function getServerPermission(): PermissionState {
  return 'granted';
}

// 이 기기의 알림 권한(허용됨·차단됨·아직 안 정함·못 씀)을 읽고, 주소창에서 바꾸면 따라간다
export function usePushPermission() {
  return useSyncExternalStore(subscribe, getPermission, getServerPermission);
}

// 버튼을 눌렀을 때만 권한을 묻고 이 기기를 등록한다
export async function requestPushPermission() {
  try {
    await registerFcmTokenForCurrentDevice({ requestPermission: true });
  } catch (error) {
    reportNonApiError('FCM 토큰 등록 실패:', error);
  }
}

interface PushPermissionNoticeProps {
  id: string;
  title: string;
  defaultText: string;
  deniedText: string;
  buttonLabel: string;
}

export function PushPermissionNotice({ id, title, defaultText, deniedText, buttonLabel }: PushPermissionNoticeProps) {
  const permission = usePushPermission();
  const [isRequesting, setIsRequesting] = useState(false);

  // 알림을 아예 못 쓰는 브라우저(홈 화면에 추가하지 않은 아이폰 등)는 누를 수 있는 게 없어 안내하지 않는다
  if (permission === 'granted' || permission === 'unsupported') return null;

  const handleAllow = async () => {
    setIsRequesting(true);
    await requestPushPermission();
    setIsRequesting(false);
  };

  return (
    <section className={cx('notice')} aria-labelledby={id}>
      <Icon name="bell" size={30} decorative />
      <div className={cx('text')}>
        <strong id={id}>{title}</strong>
        <p>{permission === 'denied' ? deniedText : defaultText}</p>
      </div>
      {permission === 'default' && (
        <button className={cx('allowButton')} type="button" disabled={isRequesting} onClick={() => void handleAllow()}>
          {buttonLabel}
        </button>
      )}
    </section>
  );
}

// 피보호자의 "약 먹을 시간" 알림은 푸시로만 간다(문자 없음, 2026-11-04 BE #441).
// 이 기기에서 알림을 허용하지 않으면 받을 길이 없으니 허용을 안내한다
export function WardPushPermissionNotice() {
  return (
    <PushPermissionNotice
      id="ward-push-permission-title"
      title="약 먹을 시간 알림이 꺼져 있어요"
      defaultText="알림을 켜 두면 약 먹을 시간에 알려 드려요."
      deniedText="주소창 왼쪽 자물쇠를 눌러 ‘알림’을 허용으로 바꿔 주세요. 그래야 약 먹을 시간에 알려 드려요."
      buttonLabel="알림 켜기"
    />
  );
}

// 보호자는 화재·낙상·SOS 알림을 이 기기 푸시로 받는다 - 허용하지 않았으면 대시보드 위에서 알린다(QA NOTI-N21)
export function GuardianPushPermissionNotice() {
  return (
    <PushPermissionNotice
      id="guardian-push-permission-title"
      title="이 기기의 알림이 꺼져 있어요"
      defaultText="알림을 허용하지 않으면 화재·낙상·SOS 같은 긴급 알림을 받을 수 없어요."
      deniedText="주소창 왼쪽 자물쇠를 눌러 ‘알림’을 허용으로 바꿔 주세요. 그래야 긴급 알림을 받을 수 있어요."
      buttonLabel="알림 허용하기"
    />
  );
}
