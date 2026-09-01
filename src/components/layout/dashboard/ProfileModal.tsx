'use client';

import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/lib/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user';
import { ProfileModalControls } from './ProfileModalControls';
import { getProviderLabel } from '@/lib/dashboard/profile';
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

export function ProfileModal({
  onClose,
  profile,
  role,
  userId,
  userEmail,
  userName,
}: Props) {
  const { mutate: logoutMutate, isPending: isLoggingOut } = useLogoutMutation();

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const onLogout = () => {
    if (isLoggingOut) return;
    setIsLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = () => {
    if (isLoggingOut) return;
    setIsLogoutConfirmOpen(false);
    logoutMutate();
  };
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
        {isLogoutConfirmOpen && (
          <CommonModal
            type="warning"
            tone="guardian"
            title="로그아웃 확인"
            message="정말 로그아웃할까요?"
            confirmText={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            secondaryText="취소"
            onConfirm={handleLogoutConfirm}
            onSecondary={() => setIsLogoutConfirmOpen(false)}
            onClose={() => setIsLogoutConfirmOpen(false)}
          />
        )}
        {/* 헤더: 아바타 + 이름 */}
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

        {/* 수정 폼 + 하단 버튼 */}
        <ProfileModalControls key={getProfileControlsKey(profile)} profile={profile} />

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
