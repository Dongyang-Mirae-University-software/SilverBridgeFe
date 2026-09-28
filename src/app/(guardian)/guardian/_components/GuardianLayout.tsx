'use client';

import { ReactNode, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { SidebarLayout } from '@/components/layout/dashboard/SidebarLayout';
import { GUARDIAN_NAV } from '@/constants/dashboard';
import { getAccessTokenSubject } from '@/lib/auth/tokenStore';
import { getRealtimeNotification } from '@/utils/dashboard/realtime';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { myProfileQueryOptions } from '@/service/query/user';
import { applyMedicationTakenToGuardianCache, guardianMedicationQueryKey } from '@/service/query/guardian/medication';
import styles from './GuardianLayout.module.css';

const cx = classNames.bind(styles);
const role = 'GUARDIAN' as const;
const rootPath = '/guardian';

export function GuardianLayout({ children }: { children: ReactNode }) {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id ?? getAccessTokenSubject() ?? undefined;
  useGuardianConnectionSocket(realtimeUserId);

  return (
    <div className={cx('stage')}>
      <SidebarLayout navItems={GUARDIAN_NAV} profile={profile} role={role} rootPath={rootPath} />
      <main className={cx('main')}>{children}</main>
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
              },
              notification: getRealtimeNotification(payload),
            },
          }),
        );
      },
    });
  }, [queryClient, realtimeUserId]);
}
