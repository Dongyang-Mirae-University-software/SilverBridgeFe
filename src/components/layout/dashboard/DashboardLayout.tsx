'use client';

import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { CommonModal } from '@/components/CommonModal';
import { useLogoutMutation } from '@/service/query/auth';
import { myProfileQueryOptions, useProfileImageChangeMutation, useProfileImageDeleteMutation } from '@/service/query/user';
import { AuthRole } from '@/lib/auth/tokenStore';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { connectConnectionSocket } from '@/lib/realtime/connectionSocket';
import { DashboardProvider } from './DashboardContext';
import { MobileTopBar } from './DashboardHeader';
import { DashboardSidebar } from './DashboardSidebar';
import { ProfileModal } from './ProfileModal';
import { GUARDIAN_NAV, PAGE_TITLES, WARD_NAV } from '@/constants/dashboard';
import { getRealtimeNotification } from '@/lib/dashboard/realtime';
import classNames from 'classnames/bind';
import styles from './DashboardLayout.module.css';

const cx = classNames.bind(styles);
import { PageKey, WardSettings } from './types';
import { DEFAULT_WARD_SETTINGS, clampFontSize, getValidSosAction, WARD_SETTINGS_STORAGE_KEY } from '@/constants/wardSettings';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role: AuthRole = pathname.startsWith('/ward') ? 'WARD' : 'GUARDIAN';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [wardSettings, setWardSettings] = useState<WardSettings>(DEFAULT_WARD_SETTINGS);
  const [isWardSettingsLoaded, setIsWardSettingsLoaded] = useState(false);
  const isWard = role === 'WARD';
  const navItems = isWard ? WARD_NAV : GUARDIAN_NAV;
  const pageKey = getPageKey(pathname, navItems);
  const pageTitle = PAGE_TITLES[pageKey];
  const rootPath = isWard ? '/ward' : '/guardian';
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = profile?.id;
  const userName = profile?.name ?? (isWard ? '사용자' : '보호자');
  const userEmail = profile?.email ?? '이메일 정보 없음';
  const { mutate: logoutMutate, isPending: isLoggingOut } = useLogoutMutation();
  const { mutate: profileImageMutate, isPending: isProfileImageChanging } = useProfileImageChangeMutation();
  const { mutate: profileImageDeleteMutate, isPending: isProfileImageDeleting } = useProfileImageDeleteMutation();

  useWardSettings(isWard, isWardSettingsLoaded, setIsWardSettingsLoaded, setWardSettings, wardSettings);
  useConnectionSocket(realtimeUserId, role);

  const stageStyle = isWard ? ({ '--ward-preferred-font-size': `${wardSettings.fontSize}px` } as CSSProperties) : undefined;
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
    if (file && !isProfileImageChanging) profileImageMutate(file);
  };
  const handleProfileImageDelete = () => {
    if (isProfileImageDeleting || !profile?.profileImage) return;
    if (!window.confirm('프로필 이미지를 삭제할까요?')) return;
    profileImageDeleteMutate();
  };

  return (
    <DashboardProvider value={{ wardSettings, updateWardSettings: settings => setWardSettings(current => ({ ...current, ...settings })) }}>
      <div className={cx('stage', { guardianTheme: !isWard, wardHighContrast: isWard && wardSettings.highContrast, wardReadableText: isWard })} style={stageStyle}>
        {isLogoutConfirmOpen && (
          <CommonModal
            type="warning"
            tone={role === 'GUARDIAN' ? 'guardian' : 'default'}
            title="로그아웃 확인"
            message="정말 로그아웃할까요?"
            confirmText={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            secondaryText="취소"
            onConfirm={handleLogoutConfirm}
            onSecondary={() => setIsLogoutConfirmOpen(false)}
            onClose={() => setIsLogoutConfirmOpen(false)}
          />
        )}
        <MobileTopBar onOpenSidebar={() => setIsSidebarOpen(true)} pageTitle={pageTitle} role={role} />
        {isSidebarOpen && <button className={cx('scrim')} type="button" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)} />}
        <DashboardSidebar
          isLoggingOut={isLoggingOut}
          isOpen={isSidebarOpen}
          navItems={navItems}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={handleLogoutRequest}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          pathname={pathname}
          profile={profile}
          role={role}
          rootPath={rootPath}
          userEmail={userEmail}
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
            userEmail={userEmail}
            userName={userName}
          />
        )}
        <main className={cx('main')}>
          {children}
        </main>
      </div>
    </DashboardProvider>
  );
}

function useWardSettings(
  isWard: boolean,
  isLoaded: boolean,
  setIsLoaded: (loaded: boolean) => void,
  setSettings: (settings: WardSettings) => void,
  settings: WardSettings,
) {
  useEffect(() => {
    if (!isWard) return;
    try {
      const rawSettings = window.localStorage.getItem(WARD_SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Partial<WardSettings>;
        setSettings({ ...DEFAULT_WARD_SETTINGS, ...parsed, fontSize: clampFontSize(parsed.fontSize), sosAction: getValidSosAction(parsed.sosAction) });
      }
    } finally {
      setIsLoaded(true);
    }
  }, [isWard, setIsLoaded, setSettings]);

  useEffect(() => {
    if (isWard && isLoaded) window.localStorage.setItem(WARD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [isWard, isLoaded, settings]);
}

function useConnectionSocket(realtimeUserId: string | undefined, role: AuthRole) {
  useEffect(() => {
    if (!realtimeUserId) return;
    return connectConnectionSocket({
      role,
      userId: realtimeUserId,
      onMessage: payload => {
        window.dispatchEvent(new CustomEvent('careai:push', { detail: { data: { connectionId: payload.connectionId ?? '', type: payload.type }, notification: getRealtimeNotification(payload) } }));
      },
    });
  }, [realtimeUserId, role]);
}

function getPageKey(pathname: string, navItems: Array<{ href: string; key: PageKey }>) {
  const matchedItem = [...navItems].sort((a, b) => b.href.length - a.href.length).find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matchedItem?.key ?? 'home';
}
