'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import classNames from 'classnames/bind';
import { MessagePayload } from 'firebase/messaging';
import { useQueryClient } from '@tanstack/react-query';

import { listenForegroundMessages } from '@/lib/fcm';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { guardianConnectionsQueryKey, wardConnectionsQueryKey } from '@/service/query/connection';
import { acceptWardConnection, refuseWardConnectionRequest } from '@/service/api/connect/ward';
import { removePendingConnectionRequest, savePendingConnectionRequest } from '@/lib/realtime/pendingConnectionRequests';
import styles from './PushNotificationListener.module.css';

const cx = classNames.bind(styles);
const TOAST_LIFETIME_MS = 6000;
type ConnectionTargetRole = 'WARD' | 'GUARDIAN';

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

function getPushRoute(data?: MessagePayload['data'], role?: ConnectionTargetRole | null) {
  switch (data?.type) {
    case 'CONNECTION_REQUEST':
    case 'CONNECTION_CANCELLED':
      return '/ward/guardians';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
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

function getCurrentRole(pathname: string): ConnectionTargetRole | null {
  if (pathname.startsWith('/ward')) return 'WARD';
  if (pathname.startsWith('/guardian')) return 'GUARDIAN';

  const role = getAuthRole();
  return role === 'WARD' || role === 'GUARDIAN' ? role : null;
}

function getConnectionTargetRole(data?: MessagePayload['data']): ConnectionTargetRole | null {
  switch (data?.type) {
    case 'CONNECTION_REQUEST':
    case 'CONNECTION_CANCELLED':
      return 'WARD';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
      return 'GUARDIAN';
    default:
      return null;
  }
}

function shouldHandleConnectionPush(data: MessagePayload['data'] | undefined, currentRole: ConnectionTargetRole | null) {
  const targetRole = getConnectionTargetRole(data);
  return !targetRole || !currentRole || targetRole === currentRole;
}

function isConnectionRequest(data?: MessagePayload['data'], currentRole?: ConnectionTargetRole | null) {
  return currentRole === 'WARD' && data?.type === 'CONNECTION_REQUEST' && Boolean(data.connectionId);
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
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const idRef = useRef(0);
  const [toasts, setToasts] = useState<PushToast[]>([]);
  const [processingToastIds, setProcessingToastIds] = useState<number[]>([]);
  const currentRole = getCurrentRole(pathname);
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);
  const addToast = useCallback((toast: PushToast) => {
    setToasts(prev => [toast, ...prev].slice(0, 3));

    if (isConnectionRequest(toast.data, currentRole)) return;

    window.setTimeout(() => {
      dismissToast(toast.id);
    }, TOAST_LIFETIME_MS);
  }, [currentRole, dismissToast]);
  const updateToastError = (id: number, error: string) => {
    setToasts(prev => prev.map(item => (item.id === id ? { ...item, error } : item)));
  };
  const invalidateConnectionQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey }),
      queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey }),
    ]);
  };
  const refreshConnectionPage = useCallback(async (data?: MessagePayload['data']) => {
    const targetRole = getConnectionTargetRole(data) ?? currentRole;
    const queryKey = targetRole === 'GUARDIAN' ? guardianConnectionsQueryKey : wardConnectionsQueryKey;

    await queryClient.invalidateQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey, type: 'active' });
    router.refresh();
  }, [currentRole, queryClient, router]);
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
      router.refresh();
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
        if (!shouldHandleConnectionPush(payload.data, currentRole)) return;
        if (isConnectionRequest(payload.data, currentRole)) savePendingConnectionRequest(payload.data);
        void refreshConnectionPage(payload.data);
      }

      addToast(toast);
    });
  }, [addToast, currentRole, refreshConnectionPage]);

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
        if (!shouldHandleConnectionPush(detail.data, currentRole)) return;
        if (isConnectionRequest(detail.data, currentRole)) savePendingConnectionRequest(detail.data);
        void refreshConnectionPage(detail.data);
      }

      addToast(toast);
    };

    window.addEventListener('careai:push', handleLocalPush);
    return () => window.removeEventListener('careai:push', handleLocalPush);
  }, [addToast, currentRole, refreshConnectionPage]);

  if (toasts.length === 0) return null;

  return (
    <div className={cx('toastArea')} aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={cx('toast', { actionAlert: isConnectionRequest(toast.data, currentRole) })}>
          {isConnectionRequest(toast.data, currentRole) ? (
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
                router.push(getPushRoute(toast.data, currentRole));
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
