import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { ProfileModalControls } from './ProfileModalControls';
import { formatProfileDate, getProviderLabel } from '@/lib/dashboard/profile';
import { cx } from './styles';

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
  userInitial: string;
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
  userInitial,
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
            <div className={cx('profilePhotoBlock')}>
              <div className={cx('profileModalAvatar')}>
                {profile?.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={profile.profileImage} />
                ) : (
                  userInitial
                )}
              </div>
              <label className={cx('profilePhotoEditButton')} aria-label="프로필 이미지 변경">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.5 7.5 10 5h4l1.5 2.5H18a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6.5a3 3 0 0 1 3-3h2.5Z" />
                  <path d="M12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isProfileImageChanging}
                  onChange={event => {
                    onProfileImageChange(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {profile?.profileImage && (
                <button
                  className={cx('profilePhotoDeleteButton')}
                  type="button"
                  aria-label="프로필 이미지 삭제"
                  disabled={isProfileImageChanging}
                  onClick={onProfileImageDelete}
                >
                  ×
                </button>
              )}
            </div>
            <div>
              <div className={cx('profileModalBadges')}>
                <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
                <span className={cx('profileProviderBadge')}>{getProviderLabel(profile?.provider)}</span>
              </div>
              <h2 id="profile-modal-title">{userName}</h2>
              <p>{userEmail}</p>
            </div>
          </div>
          <button className={cx('profileModalClose')} type="button" aria-label="사용자 상세 정보 닫기" onClick={onClose}>
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
          key={profile?.id ?? 'anonymous-profile'}
          profile={profile}
          isLoggingOut={isLoggingOut}
          onClose={onClose}
          onLogout={onLogout}
        />
      </section>
    </div>
  );
}
