'use client';

import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/utils/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user/user';
import { ProfileModalControls } from './ProfileModalControls';
import { getProviderLabel } from '@/utils/dashboard/profile';
import styles from './ProfileModal.module.css';
import { useLogoutMutation } from '@/service/query/auth';
import { useState } from 'react';
import { CommonModal } from '@/components/CommonModal';

const cx = classNames.bind(styles);

interface Props {
  onClose: () => void;
  profile: IUserProfile | null;
  role: AuthRole;
  userId: string;
  userEmail: string;
  userName: string;
}

interface ProfileHeaderProps {
  profile: IUserProfile | null;
  role: AuthRole;
  userId: string;
  userEmail: string;
  userName: string;
}

function ProfileHeader({ profile, role, userId, userEmail, userName }: ProfileHeaderProps) {
  return (
    <div className={cx('profileModalHeader')}>
      <UserAvatar size="w-120" imageUrl={profile?.profileImage} isChange isDelete />
      <div className={cx('profileHeaderInfo')}>
        <div className={cx('profileModalBadges')}>
          <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
          <span className={cx('profileProviderBadge')}>{getProviderLabel(profile?.provider)}</span>
        </div>
        <h2 id="profile-modal-title">{userName}</h2>
        <div className={cx('profileIdentity')}>
          <div className={cx('profileIdentityRow')}>
            <span>아이디</span>
            <strong>{userId}</strong>
          </div>
          <div className={cx('profileIdentityRow')}>
            <span>이메일</span>
            <strong className={cx('profileEmailText')}>{userEmail}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { mutate: logoutMutate, isPending: isLoggingOut } = useLogoutMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleLogout = () => {
    if (isLoggingOut) return;
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (isLoggingOut) return;
    setIsConfirmOpen(false);
    logoutMutate();
  };

  return (
    <>
      {isConfirmOpen && (
        <CommonModal
          type="warning"
          tone="guardian"
          title="로그아웃 확인"
          message="정말 로그아웃할까요?"
          confirmText={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
          secondaryText="취소"
          onConfirm={handleConfirm}
          onSecondary={() => setIsConfirmOpen(false)}
          onClose={() => setIsConfirmOpen(false)}
        />
      )}
      <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={handleLogout}>
        {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
      </button>
    </>
  );
}

export function ProfileModal({ onClose, profile, role, userId, userEmail, userName }: Props) {
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
        <ProfileHeader profile={profile} role={role} userId={userId} userEmail={userEmail} userName={userName} />
        <ProfileModalControls key={getProfileControlsKey(profile)} profile={profile} />
        <div className={cx('profileModalFooter')}>
          <LogoutButton />
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
