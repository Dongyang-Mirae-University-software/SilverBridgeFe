'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';
import { MessagePayload } from 'firebase/messaging';
import { useQueryClient } from '@tanstack/react-query';

import { listenForegroundMessages } from '@/lib/fcm';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { guardianConnectionsQueryKey, wardConnectionsQueryKey } from '@/service/query/connection';
import { acceptWardConnection, refuseWardConnectionRequest } from '@/service/api/connection';
import { removePendingConnectionRequest, savePendingConnectionRequest } from '@/lib/realtime/pendingConnectionRequests';
import styles from './PushNotificationListener.module.css';

const cx = classNames.bind(styles);
const TOAST_LIFETIME_MS = 6000;

interface PushToast {
  id: number;
  title: string;
  body: string;
  data?: MessagePayload['data'];
  error?: string;
}

interface LocalPushEventDetail {
  data?: Record<string, string>;
  notification?: {
    body?: string;
    title?: string;
  };
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

function isConnectionRequest(data?: MessagePayload['data']) {
  return data?.type === 'CONNECTION_REQUEST' && Boolean(data.connectionId);
}

function getConnectionId(data?: MessagePayload['data']) {
  const connectionId = Number(data?.connectionId);
  return Number.isFinite(connectionId) ? connectionId : null;
}

function getActionError(error: unknown, fallback: string) {
  return (error as Error).message || fallback;
}

export default function PushNotificationListener() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const idRef = useRef(0);
  const [toasts, setToasts] = useState<PushToast[]>([]);
  const [processingToastIds, setProcessingToastIds] = useState<number[]>([]);
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);
  const addToast = useCallback((toast: PushToast) => {
    setToasts(prev => [toast, ...prev].slice(0, 3));

    if (isConnectionRequest(toast.data)) return;

    window.setTimeout(() => {
      dismissToast(toast.id);
    }, TOAST_LIFETIME_MS);
  }, [dismissToast]);
  const updateToastError = (id: number, error: string) => {
    setToasts(prev => prev.map(item => (item.id === id ? { ...item, error } : item)));
  };
  const invalidateConnectionQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey }),
      queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey }),
    ]);
  };
  const handleConnectionAction = async (toast: PushToast, action: 'accept' | 'refuse') => {
    const connectionId = getConnectionId(toast.data);
    if (!connectionId || processingToastIds.includes(toast.id)) return;

    setProcessingToastIds(prev => [...prev, toast.id]);
    updateToastError(toast.id, '');

    try {
      if (action === 'accept') {
        await acceptWardConnection(connectionId);
      } else {
        await refuseWardConnectionRequest(connectionId);
      }

      removePendingConnectionRequest(connectionId);
      await invalidateConnectionQueries();
      dismissToast(toast.id);
    } catch (error) {
      updateToastError(
        toast.id,
        getActionError(error, action === 'accept' ? '연결 요청 수락에 실패했습니다.' : '연결 요청 거절에 실패했습니다.'),
      );
    } finally {
      setProcessingToastIds(prev => prev.filter(id => id !== toast.id));
    }
  };

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
        if (isConnectionRequest(payload.data)) savePendingConnectionRequest(payload.data);
        void queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
        void queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
      }

      addToast(toast);
    });
  }, [addToast, queryClient]);

  useEffect(() => {
    const handleLocalPush = (event: Event) => {
      const detail = (event as CustomEvent<LocalPushEventDetail>).detail;
      const id = idRef.current + 1;
      idRef.current = id;

      const toast: PushToast = {
        id,
        title: detail.notification?.title ?? '알림',
        body: detail.notification?.body ?? '',
        data: detail.data,
      };

      if (isConnectionPush(detail.data)) {
        if (isConnectionRequest(detail.data)) savePendingConnectionRequest(detail.data);
        void queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey });
        void queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey });
      }

      addToast(toast);
    };

    window.addEventListener('careai:push', handleLocalPush);
    return () => window.removeEventListener('careai:push', handleLocalPush);
  }, [addToast, queryClient]);

  if (toasts.length === 0) return null;

  return (
    <div className={cx('toastArea')} aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={cx('toast', { actionAlert: isConnectionRequest(toast.data) })}>
          {isConnectionRequest(toast.data) ? (
            <div className={cx('toastContent')}>
              <span className={cx('title')}>{toast.title}</span>
              {toast.body && <span className={cx('body')}>{toast.body}</span>}
              {toast.error && <span className={cx('error')}>{toast.error}</span>}
              <div className={cx('actionRow')}>
                <button
                  className={cx('acceptButton')}
                  type="button"
                  disabled={processingToastIds.includes(toast.id)}
                  onClick={() => void handleConnectionAction(toast, 'accept')}
                >
                  수락
                </button>
                <button
                  className={cx('refuseButton')}
                  type="button"
                  disabled={processingToastIds.includes(toast.id)}
                  onClick={() => void handleConnectionAction(toast, 'refuse')}
                >
                  거절
                </button>
              </div>
            </div>
          ) : (
            <button
              className={cx('toastContent')}
              type="button"
              onClick={() => {
                dismissToast(toast.id);
                router.push(getPushRoute(toast.data));
              }}
            >
              <span className={cx('title')}>{toast.title}</span>
              {toast.body && <span className={cx('body')}>{toast.body}</span>}
            </button>
          )}
          <button className={cx('dismissButton')} type="button" aria-label="알림 닫기" onClick={() => dismissToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
