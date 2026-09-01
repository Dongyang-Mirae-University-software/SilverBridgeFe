'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { PAGE_TITLES } from '@/constants/dashboard';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { Sidebar } from './Sidebar';
import { NavItem, PageKey } from './types';
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

  const pageTitle = PAGE_TITLES[getPageKey(pathname, navItems)];

  return (
    <>
      <div className={cx('mobileTopBar')}>
        <div className={cx('topBarBrand')}>
          <SilverBridgeLogo className={cx('topBarLogo')} width={132} />
          <span>{pageTitle}</span>
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
          className={cx('scrim')}
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsMobileMenuOpen(false)}
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
