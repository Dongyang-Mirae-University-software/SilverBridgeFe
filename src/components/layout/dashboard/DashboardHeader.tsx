import classNames from 'classnames/bind';

import { AuthRole } from '@/lib/auth/tokenStore';
import { getRoleLabel } from '@/lib/auth/routes';
import { IUserProfile } from '@/service/interface/user';
import { UserAvatar } from '@/components/UserAvatar';
import { MenuIcon } from './icons';
import styles from './DashboardHeader.module.css';

const cx = classNames.bind(styles);

interface Props {
  isProfileImageChanging: boolean;
  onOpenProfile: () => void;
  onOpenSidebar: () => void;
  pageTitle: string;
  profile?: IUserProfile | null;
  role: AuthRole;
  userEmail: string;
  userName: string;
}

export function MobileTopBar({ onOpenSidebar, pageTitle, role }: Pick<Props, 'onOpenSidebar' | 'pageTitle' | 'role'>) {
  return (
    <div className={cx('mobileTopBar')}>
      <button className={cx('topBarMenuButton')} type="button" aria-label="메뉴 열기" onClick={onOpenSidebar}>
        <MenuIcon />
        <span>메뉴</span>
      </button>
      <div className={cx('topBarBrand')}>
        <div className={cx('brandMark')}>S</div>
        <div>
          <strong>SilverBridge</strong>
          <span>{pageTitle}</span>
        </div>
      </div>
      <span className={cx('topBarRole')}>{getRoleLabel(role)}</span>
    </div>
  );
}

type DesktopHeaderProps = Pick<Props, 'onOpenProfile' | 'pageTitle' | 'profile' | 'role' | 'userEmail' | 'userName'>;

export function DesktopHeader({ onOpenProfile, pageTitle, profile, role, userEmail, userName }: DesktopHeaderProps) {
  return (
    <header className={cx('desktopHeader')}>
      <div className={cx('desktopHeaderTitle')}>
        <span className={cx('roleBadge')}>{getRoleLabel(role)} 웹</span>
        <h1>{pageTitle}</h1>
      </div>
      <button
        className={cx('desktopUserButton')}
        type="button"
        aria-haspopup="dialog"
        aria-label="사용자 상세 정보 열기"
        onClick={onOpenProfile}
      >
        <UserAvatar size="w-60" imageUrl={profile?.profileImage} />
        <div className={cx('desktopUserInfo')}>
          <strong>{userName}</strong>
          <span>{userEmail}</span>
        </div>
      </button>
    </header>
  );
}
