import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { SilverBridgeLogo } from '@/components/SilverBridgeLogo';
import { AuthRole } from '@/lib/auth/tokenStore';
import { getRoleLabel } from '@/lib/auth/routes';
import { IUserProfile } from '@/service/interface/user';
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
      <div className={cx('topBarBrand')}>
        <SilverBridgeLogo className={cx('topBarLogo')} width={132} />
      </div>
      <button className={cx('topBarMenuButton')} type="button" aria-label="메뉴 열기" onClick={onOpenSidebar}>
        <Icon name="menu" size={20} />
        <span>메뉴</span>
      </button>
    </div>
  );
}
