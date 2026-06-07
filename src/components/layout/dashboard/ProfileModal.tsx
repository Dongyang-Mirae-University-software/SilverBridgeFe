import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { formatPhoneNumber } from '@/lib/format/phone';
import { ProfileModalControls } from './ProfileModalControls';
import styles from './ProfileModal.module.css';
import { IUserProfile } from '@/service/interface/user';

const cx = classNames.bind(styles);

function formatGender(gender: IUserProfile['gender']) {
  if (gender === 'MALE') return '남성';
  if (gender === 'FEMALE') return '여성';
  return '정보 없음';
}

function formatAddress(profile: IUserProfile | null) {
  const parts = [profile?.address, profile?.addressDetail].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '정보 없음';
}

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
  const profileMetaRows = [
    { label: '성별', value: formatGender(profile?.gender ?? null) },
    { label: '생년월일', value: profile?.birthDate ?? '정보 없음' },
    { label: '전화번호', value: formatPhoneNumber(profile?.phone ?? '') || '정보 없음' },
    { label: '주소', value: formatAddress(profile) },
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
              size="w-60"
              imageUrl={profile?.profileImage}
              disabled={isProfileImageChanging}
              onImageChange={onProfileImageChange}
              onImageDelete={onProfileImageDelete}
            />
            <div>
              <div className={cx('profileModalBadges')}>
                <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
              </div>
              <h2 id="profile-modal-title">{userName}</h2>
              <p className={cx('profileUserEmail')}>{userEmail}</p>
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

        <div className={cx('profileModalMeta')}>
          {profileMetaRows.map(row => (
            <div key={row.label} className={cx('profileMetaItem')}>
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
