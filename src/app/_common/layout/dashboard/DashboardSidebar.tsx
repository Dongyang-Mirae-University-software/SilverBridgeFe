import Link from 'next/link';

import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { NavIcon } from './icons';
import { cx } from './styles';
import { NavItem } from './types';
import { UserAvatar } from './DashboardHeader';

interface Props {
  isLoggingOut: boolean;
  isOpen: boolean;
  navItems: NavItem[];
  onClose: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  pathname: string;
  profile?: IUserProfile | null;
  role: AuthRole;
  rootPath: string;
  userEmail: string;
  userInitial: string;
  userName: string;
}

export function DashboardSidebar({
  isLoggingOut,
  isOpen,
  navItems,
  onClose,
  onLogout,
  onOpenProfile,
  pathname,
  profile,
  role,
  rootPath,
  userEmail,
  userInitial,
  userName,
}: Props) {
  return (
    <aside className={cx('sidebar', { open: isOpen })} aria-label={`${getRoleLabel(role)} 메뉴`}>
      <div className={cx('brand')}>
        <div className={cx('brandMark')}>S</div>
        <div>
          <strong>SilverBridge</strong>
          <span>{getRoleLabel(role)} 웹</span>
        </div>
        <button className={cx('closeButton')} type="button" aria-label="메뉴 닫기" onClick={onClose}>
          ×
        </button>
      </div>

      <nav className={cx('nav')} aria-label={`${getRoleLabel(role)} 메뉴`}>
        {navItems.map(item => (
          <Link
            key={item.href}
            className={cx('navItem', {
              active: pathname === item.href || (item.href !== rootPath && pathname.startsWith(`${item.href}/`)),
            })}
            href={item.href}
            onClick={onClose}
          >
            <span className={cx('navIcon')}>
              <NavIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className={cx('sidebarFooter')}>
        <button className={cx('userCard')} type="button" aria-haspopup="dialog" onClick={onOpenProfile}>
          <UserAvatar profile={profile} userInitial={userInitial} />
          <div className={cx('userInfo')}>
            <div className={cx('userTitleRow')}>
              <strong>{userName}</strong>
              <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
            </div>
            <span>{userEmail}</span>
          </div>
          <span className={cx('userChevron')} aria-hidden="true">
            ›
          </span>
        </button>

        <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={onLogout}>
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    </aside>
  );
}
