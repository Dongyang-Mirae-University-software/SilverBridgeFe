import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { ProfileModalControls } from './ProfileModalControls';
import { getProviderLabel } from '@/lib/dashboard/profile';
import styles from './ProfileModal.module.css';

const cx = classNames.bind(styles);

interface Props {
  isLoggingOut: boolean;
  isProfileImageChanging: boolean;
  onClose: () => void;
  onLogout: () => void;
  onProfileImageChange: (file?: File) => void;
  onProfileImageDelete: () => void;
  profile: IUserProfile | null;
  role: AuthRole;
  userEmail: string;
  userName: string;
}

export function ProfileModal({
  isLoggingOut,
  isProfileImageChanging,
  onClose,
  onLogout,
  onProfileImageChange,
  onProfileImageDelete,
  profile,
  role,
  userEmail,
  userName,
}: Props) {
  return (
    <div className={cx('profileModalOverlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('profileModal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <button className={cx('profileModalClose')} type="button" aria-label="닫기" onClick={onClose}>
          ×
        </button>

        {/* 헤더: 아바타 + 이름 */}
        <div className={cx('profileModalHeader')}>
          <UserAvatar
            size="w-60"
            imageUrl={profile?.profileImage}
            disabled={isProfileImageChanging}
            onImageChange={onProfileImageChange}
            onImageDelete={onProfileImageDelete}
          />
          <div className={cx('profileHeaderInfo')}>
            <div className={cx('profileModalBadges')}>
              <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
              <span className={cx('profileProviderBadge')}>{getProviderLabel(profile?.provider)}</span>
            </div>
            <h2 id="profile-modal-title">{userName}</h2>
            <p className={cx('profileUserEmail')}>{userEmail}</p>
          </div>
        </div>

        {/* 수정 폼 + 하단 버튼 */}
        <ProfileModalControls
          key={getProfileControlsKey(profile)}
          profile={profile}
        />

        <div className={cx('profileModalFooter')}>
          <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={onLogout}>
            {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
          <button className={cx('profileModalGhostButton')} type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function getProfileControlsKey(profile: IUserProfile | null) {
  if (!profile) return 'profile-loading';
  return [
    profile.id,
    profile.name,
    profile.phone,
    profile.gender,
    profile.birthDate,
    profile.postcode,
    profile.address,
    profile.addressDetail,
  ].join('|');
}
