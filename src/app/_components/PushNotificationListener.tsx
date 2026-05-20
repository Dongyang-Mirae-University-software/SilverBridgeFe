'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';
import { MessagePayload } from 'firebase/messaging';
import { useQueryClient } from '@tanstack/react-query';

import { listenForegroundMessages } from '@/lib/fcm';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { guardianConnectionsQueryKey, wardConnectionsQueryKey } from '@/service/query/connection';
import styles from './PushNotificationListener.module.css';

const cx = classNames.bind(styles);
const TOAST_LIFETIME_MS = 6000;

interface PushToast {
  id: number;
  title: string;
  body: string;
  data?: MessagePayload['data'];
}

function getPushRoute(data?: MessagePayload['data']) {
  const role = getAuthRole();

  switch (data?.type) {
    case 'CONNECTION_REQUEST':
      return '/ward/guardians';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
    case 'CONNECTION_CANCELLED':
      return '/guardian/wards';
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
      return role === 'WARD' ? '/ward/guardians' : '/guardian/wards';
    default:
      return role === 'WARD' ? '/ward' : '/guardian';
  }
}

function isConnectionPush(data?: MessagePayload['data']) {
  return Boolean(data?.type && data.type.includes('CONNECTION'));
}

export default function PushNotificationListener() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const idRef = useRef(0);
  const [toasts, setToasts] = useState<PushToast[]>([]);

  useEffect(() => {
    return listenForegroundMessages(payload => {
      const id = idRef.current + 1;
      idRef.current = id;

      const toast: PushToast = {
        id,
        title: payload.notification?.title ?? '알림',
        body: payload.notification?.body ?? '',
        data: payload.data,
      };

      if (isConnectionPush(payload.data)) {
        void queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
        void queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
      }

      setToasts(prev => [toast, ...prev].slice(0, 3));
      window.setTimeout(() => {
        setToasts(prev => prev.filter(item => item.id !== id));
      }, TOAST_LIFETIME_MS);
    });
  }, [queryClient]);

  if (toasts.length === 0) return null;

  return (
    <div className={cx('toastArea')} aria-live="polite">
      {toasts.map(toast => (
        <button
          key={toast.id}
          className={cx('toast')}
          type="button"
          onClick={() => {
            setToasts(prev => prev.filter(item => item.id !== toast.id));
            router.push(getPushRoute(toast.data));
          }}
        >
          <span className={cx('title')}>{toast.title}</span>
          {toast.body && <span className={cx('body')}>{toast.body}</span>}
        </button>
      ))}
    </div>
  );
}
