import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { UserAvatar } from '@/components/UserAvatar';
import { ProfileModalControls } from './ProfileModalControls';
import { formatProfileDate, getProviderLabel } from '@/lib/dashboard/profile';
import classNames from 'classnames/bind';
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
  userPhone: string;
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
  userPhone,
}: Props) {
  const profileRows = [
    { label: '사용자 ID', value: profile?.id ?? '정보 없음' },
    { label: '전화번호', value: userPhone },
    { label: '최근 로그인', value: formatProfileDate(profile?.lastLoginAt) },
    { label: '가입일', value: formatProfileDate(profile?.createdAt) },
  ];

  return (
    <div className={cx('profileModalOverlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('profileModal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={event => event.stopPropagation()}
      >
        <div className={cx('profileModalHeader')}>
          <div className={cx('profileModalUser')}>
            <UserAvatar
              size="w-120"
              imageUrl={profile?.profileImage}
              disabled={isProfileImageChanging}
              onImageChange={onProfileImageChange}
              onImageDelete={onProfileImageDelete}
            />
            <div>
              <div className={cx('profileModalBadges')}>
                <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
                <span className={cx('profileProviderBadge')}>{getProviderLabel(profile?.provider)}</span>
              </div>
              <h2 id="profile-modal-title">{userName}</h2>
              <p>{userEmail}</p>
            </div>
          </div>
          <button
            className={cx('profileModalClose')}
            type="button"
            aria-label="사용자 상세 정보 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={cx('profileDetailGrid')}>
          {profileRows.map(row => (
            <div key={row.label} className={cx('profileDetailItem')}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>

        <ProfileModalControls
          key={getProfileControlsKey(profile)}
          profile={profile}
          isLoggingOut={isLoggingOut}
          onClose={onClose}
          onLogout={onLogout}
        />
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
