import Link from 'next/link';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { NavItem } from './types';
import { UserAvatar } from '@/components/UserAvatar';
import styles from './DashboardSidebar.module.css';

const cx = classNames.bind(styles);

interface Props {
  isOpen: boolean;
  navItems: NavItem[];
  onClose: () => void;
  onOpenProfile: () => void;
  pathname: string;
  profile?: IUserProfile | null;
  role: AuthRole;
  rootPath: string;
  userId: string;
  userName: string;
}

export function DashboardSidebar({
  isOpen,
  navItems,
  onClose,
  onOpenProfile,
  pathname,
  profile,
  role,
  rootPath,
  userId,
  userName,
}: Props) {
  return (
    <aside className={cx('sidebar', { open: isOpen })} aria-label={`${getRoleLabel(role)} 메뉴`}>
      <div className={cx('brand')}>
        <div className={cx('brandInfo')}>
          <SilverBridgeLogo className={cx('brandLogo')} width={138} />
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
              <Icon name={item.icon} size={18} />
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className={cx('sidebarFooter')}>
        <button className={cx('userCard')} type="button" aria-haspopup="dialog" onClick={onOpenProfile}>
          <UserAvatar size="w-60" imageUrl={profile?.profileImage} />
          <div className={cx('userInfo')}>
            <div className={cx('userTitleRow')}>
              <strong>{userName}</strong>
              <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
            </div>
            <span className={cx('userIdText')}>{userId}</span>
          </div>
          <span className={cx('userChevron')} aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </aside>
  );
}
