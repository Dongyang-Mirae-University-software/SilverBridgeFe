'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { MobileTopBar } from '@/components/layout/dashboard/DashboardHeader';
import { DashboardSidebar } from '@/components/layout/dashboard/DashboardSidebar';
import { ProfileModal } from '@/components/layout/dashboard/ProfileModal';
import { PageKey } from '@/components/layout/dashboard/types';
import { GUARDIAN_NAV, PAGE_TITLES } from '@/constants/dashboard';
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
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const pageKey = getPageKey(pathname);
  const pageTitle = PAGE_TITLES[pageKey];
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id ?? getAccessTokenSubject() ?? undefined;
  const userName = profile?.name ?? '보호자';
  const userId = profile?.id ?? '아이디 정보 없음';
  const userEmail = profile?.email ?? '이메일 정보 없음';
  useGuardianConnectionSocket(realtimeUserId);

  return (
    <div className={cx('stage')}>
      <MobileTopBar onOpenSidebar={() => setIsSidebarOpen(true)} pageTitle={pageTitle} role={role} />
      {isSidebarOpen && (
        <button className={cx('scrim')} type="button" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)} />
      )}
      <DashboardSidebar
        isOpen={isSidebarOpen}
        navItems={GUARDIAN_NAV}
        onClose={() => setIsSidebarOpen(false)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        pathname={pathname}
        profile={profile}
        role={role}
        rootPath={rootPath}
        userId={userId}
        userName={userName}
      />
      {isProfileModalOpen && (
        <ProfileModal
          onClose={() => setIsProfileModalOpen(false)}
          profile={profile}
          role={role}
          userId={userId}
          userEmail={userEmail}
          userName={userName}
        />
      )}
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

function getPageKey(pathname: string) {
  const matchedItem = [...GUARDIAN_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return matchedItem?.key ?? ('home' as PageKey);
}
