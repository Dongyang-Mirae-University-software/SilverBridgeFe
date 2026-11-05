'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { NotificationBellButton, NotificationPanel } from '@/components/notifications/NotificationInbox';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user/user';
import { unreadNotificationCountQueryOptions } from '@/service/query/user/notificationInbox';
import { Sidebar } from './Sidebar';
import { NavItem } from './types';
import styles from './SidebarLayout.module.css';

const cx = classNames.bind(styles);

interface SidebarLayoutProps {
  navItems: NavItem[];
  profile?: IUserProfile | null;
  role: AuthRole;
  rootPath: string;
}

// 상단 종 알림함(보호자·피보호자만 - 관리자는 403). 안 읽은 수는 실시간 이벤트가 없어 화면을 옮길 때마다 다시 받는다
function useNotificationInbox(enabled: boolean, pathname: string) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (enabled) void queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryOptions.queryKey });
  }, [enabled, pathname, queryClient]);

  return { isOpen, toggle: () => setIsOpen(open => !open), close };
}

export function SidebarLayout({ navItems, profile, role, rootPath }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isGuardianOverlay = role === 'GUARDIAN';
  const inbox = useNotificationInbox(role === 'GUARDIAN' || role === 'WARD', pathname);

  if (role === 'WARD') {
    return (
      <WardSidebarLayout
        inbox={inbox}
        isMobileMenuOpen={isMobileMenuOpen}
        navItems={navItems}
        pathname={pathname}
        profile={profile}
        role={role}
        rootPath={rootPath}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
    );
  }

  return (
    <>
      <div className={cx('mobileTopBar', { guardianTopBar: isGuardianOverlay })}>
        <div className={cx('topBarBrand')}>
          <Link className={cx('topBarBrandLink')} href={rootPath} aria-label="대시보드로 이동">
            <SilverBridgeLogo subtitle={role === 'ADMIN' ? '관리자' : undefined} variant="compactHeader" />
          </Link>
        </div>
        {role === 'GUARDIAN' && <NotificationBellButton variant="guardian" open={inbox.isOpen} onToggle={inbox.toggle} />}
        <button
          className={cx('topBarMenuButton')}
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Icon name="menu" size={20} />
          <span>메뉴</span>
        </button>
      </div>
      {role === 'GUARDIAN' && inbox.isOpen && <NotificationPanel role="GUARDIAN" variant="guardian" onClose={inbox.close} />}

      <Sidebar
        isOpen={isMobileMenuOpen}
        navItems={navItems}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        profile={profile}
        role={role}
        rootPath={rootPath}
      />

      {isMobileMenuOpen && (
        <button
          className={cx('scrim', { guardianScrim: isGuardianOverlay })}
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

interface WardSidebarLayoutProps extends SidebarLayoutProps {
  inbox: ReturnType<typeof useNotificationInbox>;
  isMobileMenuOpen: boolean;
  pathname: string;
  setIsMobileMenuOpen: (value: boolean) => void;
}

function WardSidebarLayout({
  inbox,
  isMobileMenuOpen,
  navItems,
  pathname,
  profile,
  role,
  rootPath,
  setIsMobileMenuOpen,
}: WardSidebarLayoutProps) {
  return (
    <>
      <div className={cx('wardHead')}>
        <Link className={cx('wardHeadLogoLink')} href={rootPath} aria-label="홈으로 이동">
          <SilverBridgeLogo className={cx('wardHeadLogo')} variant="wardHeader" />
        </Link>

        <div className={cx('wardHeadActions')}>
          <NotificationBellButton variant="ward" open={inbox.isOpen} onToggle={inbox.toggle} />
          {pathname !== rootPath && (
            <Link className={cx('hbtn')} href={rootPath}>
              <Icon name="arrowLeft" size={20} />
              뒤로
            </Link>
          )}
          <button className={cx('hbtn')} type="button" onClick={() => setIsMobileMenuOpen(true)}>
            <span className={cx('hbtnGlyph')}>☰</span>
            메뉴
          </button>
        </div>
      </div>
      {inbox.isOpen && <NotificationPanel role="WARD" variant="ward" onClose={inbox.close} />}

      <Sidebar
        isOpen={isMobileMenuOpen}
        navItems={navItems}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        profile={profile}
        role={role}
        rootPath={rootPath}
      />

      {isMobileMenuOpen && (
        <button
          className={cx('scrim', 'wardScrim')}
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
