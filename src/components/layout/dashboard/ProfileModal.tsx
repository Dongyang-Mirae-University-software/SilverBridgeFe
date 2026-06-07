import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { ProfileModalControls } from './ProfileModalControls';
import { getProviderLabel } from '@/lib/dashboard/profile';
import { formatPhoneNumber } from '@/lib/format/phone';
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

function formatGender(gender: IUserProfile['gender']) {
  if (gender === 'MALE') return '남성';
  if (gender === 'FEMALE') return '여성';
  return '정보 없음';
}

function formatAddress(profile: IUserProfile | null) {
  const parts = [profile?.address, profile?.addressDetail].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '정보 없음';
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
  const infoItems = [
    { label: '전화번호', value: formatPhoneNumber(profile?.phone ?? '') || '정보 없음' },
    { label: '성별', value: formatGender(profile?.gender ?? null) },
    { label: '생년월일', value: profile?.birthDate ?? '정보 없음' },
    { label: '주소', value: formatAddress(profile) },
  ];

  return (
    <div className={cx('profileModalOverlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('profileModal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <button className={cx('profileModalClose')} type="button" aria-label="닫기" onClick={onClose}>×</button>

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

        {/* 상세 정보 */}
        <dl className={cx('infoGrid')}>
          {infoItems.map(({ label, value }) => (
            <div key={label} className={cx('infoItem')}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {/* 수정 폼 + 하단 버튼 */}
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
  return [profile.id, profile.name, profile.phone, profile.gender, profile.birthDate, profile.postcode, profile.address, profile.addressDetail].join('|');
}
