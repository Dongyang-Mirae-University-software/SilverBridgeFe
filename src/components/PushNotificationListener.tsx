'use client';

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessagePayload } from 'firebase/messaging';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { listenForegroundMessages } from '@/lib/fcm';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { guardianConnectionRequestsQueryKey, guardianConnectionsQueryKey } from '@/service/query/guardian';
import { guardianSosHistoryQueryKey } from '@/service/query/guardian/sosHistory';
import { guardianMedicationQueryKey } from '@/service/query/guardian/medication';
import { guardianAnomalyHistoryQueryKey } from '@/service/query/guardian/anomaly';
import { guardianDashboardQueryKey } from '@/service/query/guardian/dashboard';
import { wardConnectionsQueryKey } from '@/service/query/ward';
import { wardTodayMedicationQueryKey } from '@/service/query/ward/medication';
import { CommonResponse } from '@/service/interface/common';
import { IConnectionItem } from '@/service/interface/connection';
import { acceptWardConnection, refuseWardConnectionRequest } from '@/service/api/ward/connection';
import { removePendingConnectionRequest, savePendingConnectionRequest } from '@/lib/realtime/pendingConnectionRequests';
import { getAnomalyAlertText } from '@/utils/anomaly/alertText';
import { getSubjectParticle } from '@/utils/format/korean';
import {
  formatReceivedAt,
  getMedicationProgress,
  getPushIconSrc,
  getPushKind,
  PUSH_KIND_LABEL,
} from './PushNotificationListener.kind';
import styles from './PushNotificationListener.module.css';

const cx = classNames.bind(styles);

const TOAST_LIFETIME_MS = 6000;
const NOTIFICATION_DEDUPE_LIFETIME_MS = 8000;
const RECEIVED_AT_TICK_MS = 30000;
// 휴대폰 위쪽 토스트를 이만큼 위로 밀면 닫는다
const SWIPE_DISMISS_PX = 48;
// 복약 막대 칸 수 상한 - 더 많으면 비율로 줄여 그린다
const MAX_PROGRESS_CELLS = 12;
type ConnectionTargetRole = 'WARD' | 'GUARDIAN';

interface PushToast {
  id: number;
  title: string;
  body: string;
  data?: MessagePayload['data'];
  error?: string;
  receivedAt: number;
}

interface ToastAction {
  label: string;
  route: string;
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
    case 'WARD_SOS':
      return '/guardian/sos';
    case 'MEDICATION_REMINDER':
      return '/ward/medication';
    case 'MEDICATION_MISSED':
    case 'MEDICATION_STOPPED':
      return '/guardian/medication';
    case 'ANOMALY_DETECTED':
      if (role === 'WARD') return '/ward';
      return data?.sessionId ? `/guardian/detection?session=${data.sessionId}` : '/guardian/detection';
    case 'ANOMALY_REVIEW_REQUIRED':
    case 'ANOMALY_REVIEW_SUMMARY':
    case 'ANOMALY_REVIEW_CONFLICTED':
    case 'CAMERA_LINK_LOST':
      return '/guardian/detection';
    default:
      return role === 'WARD' ? '/ward' : '/guardian';
  }
}

function isConnectionPush(data?: MessagePayload['data']) {
  return Boolean(data?.type && data.type.includes('CONNECTION'));
}

function getConnectionPushNotification(data?: MessagePayload['data'], role?: ConnectionTargetRole | null) {
  switch (data?.type) {
    case 'CONNECTION_REQUEST':
      return { body: '보호자가 연결을 요청했습니다.', title: '연결 요청' };
    case 'CONNECTION_ACCEPTED':
      return { body: '연결 요청이 수락되었습니다.', title: '연결 수락' };
    case 'CONNECTION_REFUSED':
      return { body: '연결 요청이 거절되었습니다.', title: '연결 거절' };
    case 'CONNECTION_CANCELLED':
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
      return { body: '연결이 해제되었습니다.', title: '연결 해제' };
    case 'WARD_SOS':
      return {
        body: `${data?.wardName ?? '피보호자'}${getSubjectParticle(data?.wardName ?? '피보호자')} 긴급 도움을 요청했습니다.`,
        title: '긴급 SOS',
      };
    case 'MEDICATION_REMINDER':
      return { body: '복용 시각이 되었습니다.', title: '복약 알림' };
    case 'MEDICATION_MISSED':
      return { body: '체크되지 않은 복약이 있습니다.', title: '복약 확인 요청' };
    case 'MEDICATION_STOPPED':
      return { body: '복약 일정이 중지되었습니다. 다시 등록해 주세요.', title: '복약 일정 중지' };
    case 'ANOMALY_DETECTED':
      // FCM 알림 제목·본문이 없을 때만 쓰는 예비 문구 - BE와 같은 종류별 안내
      return getAnomalyAlertText({
        role,
        detectedType: data?.detectedType,
        detectedTypeLabel: data?.detectedTypeLabel,
        wardName: data?.wardName,
        location: data?.location,
      });
    case 'ANOMALY_REVIEW_REQUIRED':
      return {
        body: `${data?.wardName ?? '피보호자'}의 ${data?.detectedTypeLabel ?? '이상감지'} 감지가 실제 상황이었는지 확인해 주세요.`,
        title: '이상감지 확인이 필요해요',
      };
    case 'ANOMALY_REVIEW_SUMMARY':
      return {
        body: `확인하지 않은 이상감지 ${data?.pendingCount ?? ''}건이 있습니다.`,
        title: '이상감지 확인이 필요해요',
      };
    case 'ANOMALY_REVIEW_CONFLICTED':
      return {
        body: `${data?.wardName ?? '피보호자'}의 ${data?.detectedTypeLabel ?? '이상감지'} 감지에 대해 다른 보호자와 판정이 다릅니다. 다시 확인해 주세요.`,
        title: '판정 확인 요청',
      };
    case 'CAMERA_LINK_LOST':
      // 원인을 단정하지 않는 문구(BE 푸시 본문과 같은 톤) - '꺼졌다'가 아니라 '확인되지 않는다'
      return {
        body: `${data?.wardName ?? '피보호자'} 댁 ${data?.location ?? ''} 카메라의 영상이 확인되지 않아 감시가 멈춰 있을 수 있습니다. 카메라 기기의 송출 상태를 확인해 주세요.`,
        title: '카메라 연결 확인 필요',
      };
    default:
      return { body: '', title: '알림' };
  }
}

function getPushNotificationContent({
  data,
  notification,
  role,
}: {
  data?: MessagePayload['data'];
  notification?: { body?: string; title?: string };
  role?: ConnectionTargetRole | null;
}) {
  // BE 문구(data 전용 웹푸시는 data에, 그 전에는 notification에)가 먼저, FE 예비 문구는 둘 다 없을 때만
  const fallback = getConnectionPushNotification(data, role);
  return {
    body: data?.body || notification?.body || fallback.body,
    title: data?.title || notification?.title || fallback.title,
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

function shouldHandleConnectionPush(
  data: MessagePayload['data'] | undefined,
  currentRole: ConnectionTargetRole | null,
) {
  const targetRole = getConnectionTargetRole(data);
  return !targetRole || !currentRole || targetRole === currentRole;
}

function isConnectionRequest(data?: MessagePayload['data'], currentRole?: ConnectionTargetRole | null) {
  return currentRole === 'WARD' && data?.type === 'CONNECTION_REQUEST' && Boolean(data.connectionId);
}

function isSosPush(data?: MessagePayload['data']) {
  return data?.type === 'WARD_SOS';
}

function isAnomalyPush(data?: MessagePayload['data']) {
  return data?.type === 'ANOMALY_DETECTED';
}

function isAnomalyReviewPush(data?: MessagePayload['data']) {
  return (
    data?.type === 'ANOMALY_REVIEW_REQUIRED' ||
    data?.type === 'ANOMALY_REVIEW_SUMMARY' ||
    data?.type === 'ANOMALY_REVIEW_CONFLICTED'
  );
}

function getConnectionId(data?: MessagePayload['data']) {
  const connectionId = Number(data?.connectionId);
  return Number.isFinite(connectionId) ? connectionId : null;
}

function getNotificationDedupeKey(data?: MessagePayload['data']) {
  if (!data?.type) return null;
  if (data.sosEventId) return `${data.type}:sos:${data.sosEventId}`;
  if (data.connectionId) return `${data.type}:connection:${data.connectionId}`;
  if (data.medicationId) return `${data.type}:medication:${data.medicationId}:${data.attempt ?? ''}`;
  if (data.anomalyEventId) return `${data.type}:anomaly:${data.anomalyEventId}`;
  if (data.incidentId) return `${data.type}:incident:${data.incidentId}`;
  if (data.summaryDate) return `${data.type}:summary:${data.summaryDate}`;
  if (data.wardId && data.doseDate) return `${data.type}:ward:${data.wardId}:${data.doseDate}`;
  return null;
}

function isMedicationPush(data?: MessagePayload['data']) {
  return Boolean(data?.type && data.type.startsWith('MEDICATION_'));
}

function getConnectionStatusFromPush(data?: MessagePayload['data']): IConnectionItem['status'] | null {
  switch (data?.type) {
    case 'CONNECTION_ACCEPTED':
      return 'ACTIVE';
    case 'CONNECTION_REFUSED':
      return 'REFUSED';
    case 'CONNECTION_CANCELLED':
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
      return 'DISCONNECTED';
    default:
      return null;
  }
}

function updateConnectionCache(
  queryClient: QueryClient,
  queryKey:
    | typeof guardianConnectionRequestsQueryKey
    | typeof guardianConnectionsQueryKey
    | typeof wardConnectionsQueryKey,
  connectionId: number,
  status: IConnectionItem['status'],
) {
  queryClient.setQueryData<CommonResponse<IConnectionItem[]>>(queryKey, current => {
    if (!Array.isArray(current?.data)) return current;
    return {
      ...current,
      data: current.data.map(connection => (connection.id === connectionId ? { ...connection, status } : connection)),
    };
  });
}

function applyConnectionPushToCache(
  queryClient: QueryClient,
  data: MessagePayload['data'] | undefined,
  currentRole: ConnectionTargetRole | null,
) {
  const connectionId = getConnectionId(data);
  const status = getConnectionStatusFromPush(data);
  if (!connectionId || !status) return;

  const targetRole = getConnectionTargetRole(data);
  if (targetRole === 'GUARDIAN') {
    updateConnectionCache(queryClient, guardianConnectionsQueryKey, connectionId, status);
    updateConnectionCache(queryClient, guardianConnectionRequestsQueryKey, connectionId, status);
    return;
  }
  if (targetRole === 'WARD') {
    updateConnectionCache(queryClient, wardConnectionsQueryKey, connectionId, status);
    return;
  }
  if (currentRole === 'GUARDIAN') {
    updateConnectionCache(queryClient, guardianConnectionsQueryKey, connectionId, status);
    updateConnectionCache(queryClient, guardianConnectionRequestsQueryKey, connectionId, status);
  } else if (currentRole === 'WARD') {
    updateConnectionCache(queryClient, wardConnectionsQueryKey, connectionId, status);
  }
}

// 브라우저 알림 버튼과 같은 두 버튼(public/push-sw-logic.js getActions·getPath)
function getToastActions(data: MessagePayload['data'] | undefined, role: ConnectionTargetRole | null): ToastAction[] {
  if (role === 'WARD') return [];
  if (data?.type === 'WARD_SOS') {
    return [
      { label: 'SOS 화면 열기', route: '/guardian/sos' },
      { label: '가족 연락처', route: '/guardian/wards' },
    ];
  }
  if (data?.type === 'ANOMALY_DETECTED') {
    const session = data.sessionId ? `?session=${encodeURIComponent(data.sessionId)}` : '';
    return [
      { label: '영상 확인', route: '/guardian/detection' },
      { label: '실시간 보기', route: `/guardian/detection${session}` },
    ];
  }
  return [];
}

function isUrgentPush(data?: MessagePayload['data']) {
  return isSosPush(data) || isAnomalyPush(data);
}

function BridgeMark() {
  return (
    <svg className={cx('bridgeMark')} viewBox="0 0 192 192" aria-hidden="true" focusable="false">
      <path d="M52 114 C70 66 122 66 140 114" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
      <rect x="36" y="112" width="120" height="18" rx="9" fill="currentColor" />
      <rect x="56" y="126" width="16" height="30" rx="4" fill="currentColor" />
      <rect x="120" y="126" width="16" height="30" rx="4" fill="currentColor" />
    </svg>
  );
}

function getActionError(error: unknown, fallback: string) {
  return (error as Error).message || fallback;
}

export default function PushNotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const idRef = useRef(0);
  const handledNotificationKeysRef = useRef<Map<string, number>>(new Map());
  const [toasts, setToasts] = useState<PushToast[]>([]);
  const [processingToastIds, setProcessingToastIds] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const swipeRef = useRef<{ id: number; startY: number; dy: number } | null>(null);
  const [swipe, setSwipe] = useState<{ id: number; dy: number } | null>(null);
  const currentRole = getCurrentRole(pathname);
  const hasToasts = toasts.length > 0;

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);

  // "방금·N분 전"을 갱신한다 - 토스트가 떠 있을 때만
  useEffect(() => {
    if (!hasToasts) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), RECEIVED_AT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [hasToasts]);

  // 휴대폰(위쪽 토스트)에서 위로 밀어 닫기. 손가락·펜만 - 마우스 끌기는 글자 선택과 겹친다
  const handleSwipeStart = (id: number, event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return;
    swipeRef.current = { id, startY: event.clientY, dy: 0 };
  };

  const handleSwipeMove = (event: PointerEvent<HTMLElement>) => {
    const current = swipeRef.current;
    if (!current) return;
    current.dy = Math.min(0, event.clientY - current.startY);
    setSwipe({ id: current.id, dy: current.dy });
  };

  const handleSwipeEnd = () => {
    const current = swipeRef.current;
    swipeRef.current = null;
    setSwipe(null);
    if (current && current.dy <= -SWIPE_DISMISS_PX) dismissToast(current.id);
  };

  const addToast = useCallback(
    (toast: PushToast) => {
      const dedupeKey = getNotificationDedupeKey(toast.data);

      if (dedupeKey) {
        const now = Date.now();
        const handledAt = handledNotificationKeysRef.current.get(dedupeKey);

        if (handledAt && now - handledAt < NOTIFICATION_DEDUPE_LIFETIME_MS) return;

        handledNotificationKeysRef.current.set(dedupeKey, now);
        handledNotificationKeysRef.current.forEach((timestamp, key) => {
          if (now - timestamp > NOTIFICATION_DEDUPE_LIFETIME_MS) handledNotificationKeysRef.current.delete(key);
        });
      }

      setToasts(prev => [toast, ...prev].slice(0, 3));
      if (isConnectionRequest(toast.data, currentRole) || isSosPush(toast.data) || isAnomalyPush(toast.data)) return;
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, TOAST_LIFETIME_MS);
    },
    [currentRole, dismissToast],
  );

  const updateToastError = (id: number, error: string) => {
    setToasts(prev => prev.map(item => (item.id === id ? { ...item, error } : item)));
  };

  const invalidateConnectionQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: wardConnectionsQueryKey }),
      queryClient.invalidateQueries({ queryKey: guardianConnectionsQueryKey }),
      queryClient.invalidateQueries({ queryKey: guardianConnectionRequestsQueryKey }),
    ]);
  };

  const refreshConnectionPage = useCallback(
    async (data?: MessagePayload['data']) => {
      const targetRole = getConnectionTargetRole(data) ?? currentRole;
      const queryKeys = targetRole === 'GUARDIAN'
        ? [guardianConnectionsQueryKey, guardianConnectionRequestsQueryKey]
        : [wardConnectionsQueryKey];

      applyConnectionPushToCache(queryClient, data, currentRole);
      await Promise.all(queryKeys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
      await Promise.all(queryKeys.map(queryKey => queryClient.refetchQueries({ queryKey, type: 'active' })));
      router.refresh();
    },
    [currentRole, queryClient, router],
  );

  const refreshSosPage = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: guardianSosHistoryQueryKey });
    await queryClient.refetchQueries({ queryKey: guardianSosHistoryQueryKey, type: 'active' });
    router.refresh();
  }, [queryClient, router]);

  const refreshAnomalyPage = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: guardianAnomalyHistoryQueryKey });
    await queryClient.invalidateQueries({ queryKey: guardianDashboardQueryKey });
    await queryClient.refetchQueries({ queryKey: guardianAnomalyHistoryQueryKey, type: 'active' });
    router.refresh();
  }, [queryClient, router]);

  const refreshMedicationPage = useCallback(
    async (data?: MessagePayload['data']) => {
      // MEDICATION_REMINDER는 피보호자의 오늘 일정, MISSED/STOPPED는 보호자의 카드 목록에 영향을 준다
      const queryKey = data?.type === 'MEDICATION_REMINDER' ? wardTodayMedicationQueryKey : guardianMedicationQueryKey;
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.refetchQueries({ queryKey, type: 'active' });
      router.refresh();
    },
    [queryClient, router],
  );

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
        getActionError(
          error,
          action === 'accept' ? '연결 요청 수락에 실패했습니다.' : '연결 요청 거절에 실패했습니다.',
        ),
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
        role: currentRole,
      });
      const toast: PushToast = {
        id,
        title: notification.title,
        body: notification.body,
        data: payload.data,
        receivedAt: Date.now(),
      };

      if (isConnectionPush(payload.data)) {
        if (!shouldHandleConnectionPush(payload.data, currentRole)) return;
        if (isConnectionRequest(payload.data, currentRole)) savePendingConnectionRequest(payload.data);
        void refreshConnectionPage(payload.data);
      }
      if (isSosPush(payload.data)) void refreshSosPage();
      if (isMedicationPush(payload.data)) void refreshMedicationPage(payload.data);
      if (isAnomalyPush(payload.data) || isAnomalyReviewPush(payload.data)) void refreshAnomalyPage();
      addToast(toast);
    });
  }, [addToast, currentRole, refreshAnomalyPage, refreshConnectionPage, refreshMedicationPage, refreshSosPage]);

  useEffect(() => {
    const handleLocalPush = (event: Event) => {
      const detail = (event as CustomEvent<LocalPushEventDetail>).detail;
      const id = idRef.current + 1;
      idRef.current = id;
      const notification = getPushNotificationContent({
        data: detail.data,
        notification: detail.notification,
        role: currentRole,
      });
      const toast: PushToast = {
        id,
        title: notification.title,
        body: notification.body,
        data: detail.data,
        receivedAt: Date.now(),
      };

      if (isConnectionPush(detail.data)) {
        if (!shouldHandleConnectionPush(detail.data, currentRole)) return;
        if (isConnectionRequest(detail.data, currentRole)) savePendingConnectionRequest(detail.data);
        void refreshConnectionPage(detail.data);
      }
      if (isSosPush(detail.data)) void refreshSosPage();
      if (isMedicationPush(detail.data)) void refreshMedicationPage(detail.data);
      if (isAnomalyPush(detail.data) || isAnomalyReviewPush(detail.data)) void refreshAnomalyPage();
      addToast(toast);
    };

    window.addEventListener('careai:push', handleLocalPush);
    return () => window.removeEventListener('careai:push', handleLocalPush);
  }, [addToast, currentRole, refreshAnomalyPage, refreshConnectionPage, refreshMedicationPage, refreshSosPage]);

  if (toasts.length === 0) return null;

  return (
    <div className={cx('toastArea')} aria-label="새 알림">
      {toasts.map(toast => {
        const kind = getPushKind(toast.data);
        const urgent = isUrgentPush(toast.data);
        const connectionRequest = isConnectionRequest(toast.data, currentRole);
        const actions = getToastActions(toast.data, currentRole);
        const progress = getMedicationProgress(toast.data);
        const processing = processingToastIds.includes(toast.id);
        const swipeOffset = swipe?.id === toast.id ? swipe.dy : 0;
        const progressCells = progress ? Math.min(progress.total, MAX_PROGRESS_CELLS) : 0;
        const filledCells = progress ? Math.round((progress.taken / progress.total) * progressCells) : 0;

        const openRoute = (route: string) => {
          dismissToast(toast.id);
          router.push(route);
        };

        const content = (
          <>
            {/* 브라우저 알림과 같은 그림(public/icons/push) - 장식이라 대체 문구를 비운다 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={cx('kindIcon')} src={getPushIconSrc(toast.data)} alt="" width={40} height={40} />
            <span className={cx('text')}>
              <span className={cx('title')}>{toast.title}</span>
              {toast.body && <span className={cx('body')}>{toast.body}</span>}
            </span>
          </>
        );

        return (
          <section
            key={toast.id}
            role={urgent ? 'alert' : 'status'}
            aria-live={urgent ? 'assertive' : 'polite'}
            aria-label={`${PUSH_KIND_LABEL[kind]} 알림`}
            className={cx('toast', `kind-${kind}`, { swiping: swipeOffset !== 0 })}
            style={swipeOffset ? { transform: `translateY(${swipeOffset}px)` } : undefined}
            onPointerDown={event => handleSwipeStart(toast.id, event)}
            onPointerMove={handleSwipeMove}
            onPointerUp={handleSwipeEnd}
            onPointerCancel={handleSwipeEnd}
          >
            <header className={cx('meta')}>
              <BridgeMark />
              <span className={cx('kindLabel')}>{PUSH_KIND_LABEL[kind]}</span>
              <span className={cx('receivedAt')}>{formatReceivedAt(toast.receivedAt, now)}</span>
              <button
                className={cx('dismissButton')}
                type="button"
                aria-label={`${toast.title} 알림 닫기`}
                onClick={() => dismissToast(toast.id)}
              >
                ×
              </button>
            </header>

            {connectionRequest ? (
              <div className={cx('main')}>{content}</div>
            ) : (
              <button
                className={cx('main', 'mainButton')}
                type="button"
                onClick={() => openRoute(getPushRoute(toast.data, currentRole))}
              >
                {content}
              </button>
            )}

            {progress && (
              <div className={cx('progress')}>
                <span className={cx('progressBar')} aria-hidden="true">
                  {Array.from({ length: progressCells }, (_, index) => (
                    <span key={index} className={cx('progressCell', { filled: index < filledCells })} />
                  ))}
                </span>
                <span className={cx('progressLabel')}>
                  {progress.total}번 중 {progress.taken}번 체크
                </span>
              </div>
            )}

            {toast.error && <span className={cx('error')}>{toast.error}</span>}

            {connectionRequest ? (
              <div className={cx('actionRow')}>
                <button
                  className={cx('primaryButton')}
                  type="button"
                  disabled={processing}
                  onClick={() => void handleConnectionAction(toast, 'accept')}
                >
                  수락
                </button>
                <button
                  className={cx('secondaryButton')}
                  type="button"
                  disabled={processing}
                  onClick={() => void handleConnectionAction(toast, 'refuse')}
                >
                  거절
                </button>
              </div>
            ) : (
              actions.length > 0 && (
                <div className={cx('actionRow')}>
                  {actions.map((action, index) => (
                    <button
                      key={action.label}
                      className={cx(index === 0 ? 'primaryButton' : 'secondaryButton')}
                      type="button"
                      onClick={() => openRoute(action.route)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )
            )}
          </section>
        );
      })}
    </div>
  );
}
