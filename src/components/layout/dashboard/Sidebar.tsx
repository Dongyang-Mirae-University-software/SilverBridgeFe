'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { PAGE_TITLES } from '@/constants/dashboard';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { DashboardSidebar } from './DashboardSidebar';
import { ProfileModal } from './ProfileModal';
import { NavItem, PageKey } from './types';
import styles from './Sidebar.module.css';

const cx = classNames.bind(styles);

const ROLE_DEFAULT_NAME: Record<AuthRole, string> = {
  ADMIN: '관리자',
  GUARDIAN: '보호자',
  WARD: '사용자',
};

interface SidebarProps {
  navItems?: NavItem[];
  onOpenSidebar?: () => void;
  pageTitle?: string;
  profile?: IUserProfile | null;
  role: AuthRole;
  rootPath?: string;
}

export function Sidebar({ navItems, onOpenSidebar, pageTitle, profile, role, rootPath }: SidebarProps) {
  const pathname = usePathname();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const canRenderSidebar = Boolean(navItems && pathname && rootPath);

  const resolvedPageTitle = pageTitle ?? (navItems && pathname ? PAGE_TITLES[getPageKey(pathname, navItems)] : '');
  const userName = profile?.name ?? ROLE_DEFAULT_NAME[role];
  const userId = profile?.id ?? '아이디 정보 없음';
  const userEmail = profile?.email ?? '이메일 정보 없음';

  const handleOpenSidebar = () => {
    if (canRenderSidebar) {
      setIsSidebarOpen(true);
      return;
    }
    onOpenSidebar?.();
  };

  return (
    <>
      <div className={cx('mobileTopBar')}>
        <div className={cx('topBarBrand')}>
          <SilverBridgeLogo className={cx('topBarLogo')} width={132} />
          <span>{resolvedPageTitle}</span>
        </div>
        <button className={cx('topBarMenuButton')} type="button" aria-label="메뉴 열기" onClick={handleOpenSidebar}>
          <Icon name="menu" size={20} />
          <span>메뉴</span>
        </button>
      </div>

      {canRenderSidebar && isSidebarOpen && (
        <button className={cx('scrim')} type="button" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)} />
      )}
      {canRenderSidebar && (
        <DashboardSidebar
          isOpen={isSidebarOpen}
          navItems={navItems ?? []}
          onClose={() => setIsSidebarOpen(false)}
          onOpenProfile={() => {
            setIsSidebarOpen(false);
            setIsProfileModalOpen(true);
          }}
          pathname={pathname ?? ''}
          profile={profile}
          role={role}
          rootPath={rootPath ?? ''}
          userId={userId}
          userName={userName}
        />
      )}
      {isProfileModalOpen && (
        <ProfileModal
          onClose={() => setIsProfileModalOpen(false)}
          profile={profile ?? null}
          role={role}
          userId={userId}
          userEmail={userEmail}
          userName={userName}
        />
      )}
    </>
  );
}

function getPageKey(pathname: string, navItems: NavItem[]): PageKey {
  const matchedItem = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return matchedItem?.key ?? 'home';
}
