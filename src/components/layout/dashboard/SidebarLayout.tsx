'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user/user';
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

export function SidebarLayout({ navItems, profile, role, rootPath }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isGuardianOverlay = role === 'GUARDIAN';

  if (role === 'WARD') {
    return (
      <WardSidebarLayout
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
  isMobileMenuOpen: boolean;
  pathname: string;
  setIsMobileMenuOpen: (value: boolean) => void;
}

function WardSidebarLayout({
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
