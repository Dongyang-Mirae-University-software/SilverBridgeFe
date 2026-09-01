'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { DashboardSidebar } from './DashboardSidebar';
import { ProfileModal } from './ProfileModal';
import { NavItem } from './types';
import styles from './DashboardHeader.module.css';

const cx = classNames.bind(styles);

interface MobileTopBarProps {
  navItems?: NavItem[];
  onOpenSidebar?: () => void;
  pageTitle: string;
  pathname?: string;
  profile?: IUserProfile | null;
  role: AuthRole;
  rootPath?: string;
  userEmail?: string;
  userId?: string;
  userName?: string;
}

export function MobileTopBar({
  navItems,
  onOpenSidebar,
  pageTitle,
  pathname,
  profile,
  role,
  rootPath,
  userEmail = '이메일 정보 없음',
  userId = '아이디 정보 없음',
  userName = '사용자',
}: MobileTopBarProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const canRenderSidebar = Boolean(navItems && pathname && rootPath);

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
          <span>{pageTitle}</span>
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
