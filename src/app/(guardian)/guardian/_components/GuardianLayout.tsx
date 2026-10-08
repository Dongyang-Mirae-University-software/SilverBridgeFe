'use client';

import { ReactNode, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import classNames from 'classnames/bind';

import { SidebarLayout } from '@/components/layout/dashboard/SidebarLayout';
import { GUARDIAN_NAV } from '@/constants/dashboard';
import { getAccessTokenSubject } from '@/lib/auth/tokenStore';
import { getRealtimeNotification } from '@/utils/dashboard/realtime';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { myProfileQueryOptions } from '@/service/query/user';
import { applyMedicationTakenToGuardianCache, guardianMedicationQueryKey } from '@/service/query/guardian/medication';
import { guardianAnomalyHistoryQueryKey } from '@/service/query/guardian/anomaly';
import styles from './GuardianLayout.module.css';

const cx = classNames.bind(styles);
const role = 'GUARDIAN' as const;
const rootPath = '/guardian';

export function GuardianLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id ?? getAccessTokenSubject() ?? undefined;
  useGuardianConnectionSocket(realtimeUserId);

  return (
    <div className={cx('stage', { medicationStage: pathname === '/guardian/medication' })}>
      <SidebarLayout navItems={GUARDIAN_NAV} profile={profile} role={role} rootPath={rootPath} />
      <main className={cx('main', { chatMain: pathname === '/guardian/chatbot' })}>{children}</main>
    </div>
  );
}

function useGuardianConnectionSocket(realtimeUserId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!realtimeUserId) return;
    return connectConnectionSocket({
      role,
      userId: realtimeUserId,
      onMessage: payload => {
        // 복약 체크 실시간 동기화는 소음이 되지 않도록 알림 없이 카드만 조용히 갱신한다
        if (payload.type === 'MEDICATION_TAKEN') {
          applyMedicationTakenToGuardianCache(queryClient, payload);
          return;
        }
        if (payload.type === 'MEDICATION_STOPPED') {
          void queryClient.invalidateQueries({ queryKey: guardianMedicationQueryKey });
        }
        if (payload.type === 'ANOMALY_DETECTED') {
          void queryClient.invalidateQueries({ queryKey: guardianAnomalyHistoryQueryKey });
        }

        // 카메라 분석 상태는 화면 표시용 데이터일 뿐이라 토스트·알림음을 띄우지 않는다 —
        // 실시간 카메라 화면(useGuardianMonitor)만 듣도록 별도 이벤트로 전달한다
        if (payload.type === 'CAMERA_ANALYSIS') {
          window.dispatchEvent(new CustomEvent('careai:camera-analysis', { detail: payload }));
          return;
        }

        window.dispatchEvent(
          new CustomEvent('careai:push', {
            detail: {
              data: {
                body: payload.body ?? '',
                connectionId: payload.connectionId ?? '',
                from: payload.from ?? '',
                sosEventId: payload.sosEventId ?? '',
                title: payload.title ?? '',
                type: payload.type === 'SOS_TRIGGERED' ? 'WARD_SOS' : payload.type,
                wardId: payload.wardId ?? '',
                wardName: payload.wardName ?? '',
                location: payload.location ?? '',
                detectedType: payload.detectedType ?? '',
                detectedTypeLabel: payload.detectedTypeLabel ?? '',
                sessionId: payload.sessionId ?? '',
                anomalyEventId: payload.anomalyEventId ?? '',
                incidentId: payload.incidentId ?? '',
                detectedAt: payload.detectedAt ?? '',
              },
              notification: getRealtimeNotification(payload, role),
            },
          }),
        );
      },
    });
  }, [queryClient, realtimeUserId]);
}
