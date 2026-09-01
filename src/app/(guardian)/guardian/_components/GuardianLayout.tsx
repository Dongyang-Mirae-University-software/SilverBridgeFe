'use client';

import { ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Sidebar } from '@/components/layout/dashboard/Sidebar';
import { GUARDIAN_NAV } from '@/constants/dashboard';
import { getAccessTokenSubject } from '@/lib/auth/tokenStore';
import { getRealtimeNotification } from '@/lib/dashboard/realtime';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { myProfileQueryOptions } from '@/service/query/user';
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
      <Sidebar navItems={GUARDIAN_NAV} profile={profile} role={role} rootPath={rootPath} />
      <main className={cx('main')}>{children}</main>
    </div>
  );
}

function useGuardianConnectionSocket(realtimeUserId: string | undefined) {
  useEffect(() => {
    if (!realtimeUserId) return;
    return connectConnectionSocket({
      role,
      userId: realtimeUserId,
      onMessage: payload => {
        window.dispatchEvent(
          new CustomEvent('careai:push', {
            detail: {
              data: {
                body: payload.body ?? '',
                connectionId: payload.connectionId ?? '',
                from: payload.from ?? '',
                title: payload.title ?? '',
                type: payload.type,
              },
              notification: getRealtimeNotification(payload),
            },
          }),
        );
      },
    });
  }, [realtimeUserId]);
}
