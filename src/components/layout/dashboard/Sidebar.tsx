'use client';

import Link from 'next/link';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { getRoleLabel } from '@/utils/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user/user';
import { NavItem } from './types';
import { ProfileModal } from './ProfileModal';
import { UserAvatar } from '@/components/UserAvatar';
import useModalStore from '@/store/modalStore';
import styles from './Sidebar.module.css';

const cx = classNames.bind(styles);

const ROLE_DEFAULT_NAME: Record<AuthRole, string> = {
  ADMIN: '관리자',
  GUARDIAN: '보호자',
  WARD: '사용자',
};

interface Props {
  isOpen: boolean;
  navItems: NavItem[];
  onClose: () => void;
  pathname: string;
  profile?: IUserProfile | null;
  role: AuthRole;
  rootPath: string;
}

export function Sidebar({ isOpen, navItems, onClose, pathname, profile, role, rootPath }: Props) {
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));

  const activeHref = getActiveNavHref(navItems, pathname, rootPath);

  const userName = profile?.name ?? ROLE_DEFAULT_NAME[role];
  const userId = profile?.id ?? '아이디 정보 없음';
  const userEmail = profile?.email ?? '이메일 정보 없음';

  const handleOpenProfile = () => {
    onClose();
    openModal(
      <ProfileModal
        onClose={onCloseModal}
        profile={profile ?? null}
        role={role}
        userId={userId}
        userEmail={userEmail}
        userName={userName}
      />,
    );
  };

  return (
    <>
      <aside className={cx('sidebar', { open: isOpen, sidebarWard: role === 'WARD' })} aria-label={`${getRoleLabel(role)} 메뉴`}>
        <button className={cx('closeButton')} type="button" aria-label="메뉴 닫기" onClick={onClose}>
          x
        </button>

        <div className={cx('brand')}>
          <div className={cx('brandInfo')}>
            <Link className={cx('brandLink')} href={rootPath} onClick={onClose} aria-label="대시보드로 이동">
              <SilverBridgeLogo subtitle={`${getRoleLabel(role)} 웹`} />
            </Link>
          </div>
        </div>

        <nav className={cx('nav')} aria-label={`${getRoleLabel(role)} 메뉴`}>
          {navItems.map(item => (
            <Link
              key={item.href}
              className={cx('navItem', { active: item.href === activeHref })}
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
          <button className={cx('userCard')} type="button" aria-haspopup="dialog" onClick={handleOpenProfile}>
            <UserAvatar size="w-38" imageUrl={profile?.profileImage} />
            <div className={cx('userInfo')}>
              <div className={cx('userName')}>{userName}</div>
              <div className={cx('userRole')}>
                <Icon name="user" size={10} />내 프로필
              </div>
            </div>
            <span className={cx('userChevron')} aria-hidden="true">
              <Icon name="chevronRight" size={14} />
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

// 중첩 경로(예: /guardian/wards와 /guardian/wards/register)가 서로 접두어를 공유할 때
// 여러 항목이 동시에 활성화되지 않도록, 가장 길게 일치하는 href 하나만 고른다
function getActiveNavHref(navItems: NavItem[], pathname: string, rootPath: string) {
  const matched = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname === item.href || (item.href !== rootPath && pathname.startsWith(`${item.href}/`)));

  return matched?.href;
}
