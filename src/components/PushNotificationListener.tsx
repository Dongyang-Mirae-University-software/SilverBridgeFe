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
      return '/ward/guardians';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
      return '/guardian/wards';
    case 'CONNECTION_CANCELLED':
      return role === 'GUARDIAN' ? '/guardian/wards' : '/ward/guardians';
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

function getConnectionPushNotification(data?: MessagePayload['data']) {
  switch (data?.type) {
    case 'CONNECTION_REQUEST':
      return {
        body: '보호자가 연결을 요청했습니다.',
        title: '연결 요청',
      };
    case 'CONNECTION_ACCEPTED':
      return {
        body: '연결 요청이 수락되었습니다.',
        title: '연결 수락',
      };
    case 'CONNECTION_REFUSED':
      return {
        body: '연결 요청이 거절되었습니다.',
        title: '연결 거절',
      };
    case 'CONNECTION_CANCELLED':
      return {
        body: '연결이 해제되었습니다.',
        title: '연결 해제',
      };
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
      return {
        body: '연결이 해제되었습니다.',
        title: '연결 해제',
      };
    default:
      return {
        body: '',
        title: '알림',
      };
  }
}

function getPushNotificationContent({
  data,
  notification,
}: {
  data?: MessagePayload['data'];
  notification?: { body?: string; title?: string };
}) {
  const fallback = getConnectionPushNotification(data);

  return {
    body: notification?.body ?? fallback.body,
    title: notification?.title ?? fallback.title,
  };
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
      return 'WARD';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
      return 'GUARDIAN';
    case 'CONNECTION_CANCELLED':
      return null;
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
      const notification = getPushNotificationContent({
        data: payload.data,
        notification: payload.notification,
      });

      const toast: PushToast = {
        id,
        title: notification.title,
        body: notification.body,
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
      const notification = getPushNotificationContent({
        data: detail.data,
        notification: detail.notification,
      });

      const toast: PushToast = {
        id,
        title: notification.title,
        body: notification.body,
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
