'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { MobileTopBar } from '@/components/layout/dashboard/DashboardHeader';
import { DashboardSidebar } from '@/components/layout/dashboard/DashboardSidebar';
import { ProfileModal } from '@/components/layout/dashboard/ProfileModal';
import { PageKey } from '@/components/layout/dashboard/types';
import { GUARDIAN_NAV, PAGE_TITLES } from '@/constants/dashboard';
import { getAccessTokenSubject } from '@/lib/auth/tokenStore';
import { getRealtimeNotification } from '@/lib/dashboard/realtime';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { useLogoutMutation } from '@/service/query/auth';
import {
  myProfileQueryOptions,
  useProfileImageChangeMutation,
  useProfileImageDeleteMutation,
} from '@/service/query/user';
import styles from './GuardianLayout.module.css';

const cx = classNames.bind(styles);
const role = 'GUARDIAN' as const;
const rootPath = '/guardian';

export function GuardianLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [profileImageError, setProfileImageError] = useState('');
  const pageKey = getPageKey(pathname);
  const pageTitle = PAGE_TITLES[pageKey];
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id ?? getAccessTokenSubject() ?? undefined;
  const userName = profile?.name ?? '보호자';
  const userId = profile?.id ?? '아이디 정보 없음';
  const userEmail = profile?.email ?? '이메일 정보 없음';
  const { mutate: logoutMutate, isPending: isLoggingOut } = useLogoutMutation();
  const { mutate: profileImageMutate, isPending: isProfileImageChanging } = useProfileImageChangeMutation({
    onError: message => setProfileImageError(message),
  });
  const { mutate: profileImageDeleteMutate, isPending: isProfileImageDeleting } = useProfileImageDeleteMutation({
    onError: message => setProfileImageError(message),
  });

  useGuardianConnectionSocket(realtimeUserId);

  const handleLogoutRequest = () => {
    if (isLoggingOut) return;
    setIsLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = () => {
    if (isLoggingOut) return;
    setIsLogoutConfirmOpen(false);
    logoutMutate();
  };

  const handleProfileImageChange = (file?: File) => {
    if (!file || isProfileImageChanging) return;
    setProfileImageError('');
    profileImageMutate(file);
  };

  const handleProfileImageDelete = () => {
    if (isProfileImageDeleting || !profile?.profileImage) return;
    if (!window.confirm('프로필 이미지를 삭제할까요?')) return;
    setProfileImageError('');
    profileImageDeleteMutate();
  };

  const handleProfileImageErrorClose = () => setProfileImageError('');

  return (
    <div className={cx('stage')}>
      {isLogoutConfirmOpen && (
        <CommonModal
          type="warning"
          tone="guardian"
          title="로그아웃 확인"
          message="정말 로그아웃할까요?"
          confirmText={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
          secondaryText="취소"
          onConfirm={handleLogoutConfirm}
          onSecondary={() => setIsLogoutConfirmOpen(false)}
          onClose={() => setIsLogoutConfirmOpen(false)}
        />
      )}
      {profileImageError && (
        <CommonModal
          type="error"
          title="프로필 이미지 처리 실패"
          message={profileImageError}
          confirmText="확인"
          onConfirm={handleProfileImageErrorClose}
          onClose={handleProfileImageErrorClose}
        />
      )}
      <MobileTopBar onOpenSidebar={() => setIsSidebarOpen(true)} pageTitle={pageTitle} role={role} />
      {isSidebarOpen && (
        <button
          className={cx('scrim')}
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsSidebarOpen(false)}
        />
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
          isLoggingOut={isLoggingOut}
          isProfileImageChanging={isProfileImageChanging || isProfileImageDeleting}
          onClose={() => setIsProfileModalOpen(false)}
          onLogout={handleLogoutRequest}
          onProfileImageDelete={handleProfileImageDelete}
          onProfileImageChange={handleProfileImageChange}
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
