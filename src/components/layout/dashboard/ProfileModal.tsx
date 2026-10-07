'use client';

import { useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/utils/auth/routes';
import { AuthRole } from '@/lib/auth/tokenStore';
import { IUserProfile } from '@/service/interface/user/user';
import { ProfileModalControls, ProfileModalControlsHandle } from './ProfileModalControls';
import { getProviderLabel } from '@/utils/dashboard/profile';
import styles from './ProfileModal.module.css';
import { useLogoutMutation } from '@/service/query/auth';
import { CommonModal } from '@/components/CommonModal';
import useModalStore from '@/store/modalStore';

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
  const avatarSize = role === 'WARD' ? 'w-72' : 'w-56';

  return (
    <>
      <div className={cx('profileModalHeader')}>
        <UserAvatar size={avatarSize} imageUrl={profile?.profileImage} isChange isDelete />
        <div className={cx('profileHeaderInfo')}>
          <h2 id="profile-modal-title">{userName}</h2>
          <div className={cx('profileMemberId')}>회원 ID · {userId}</div>
        </div>
        <span className={cx('profileProviderBadge')}>{getProviderLabel(profile?.provider)}</span>
      </div>

      <div className={cx('profileIdentityRow')}>
        <span>가입 유형</span>
        <strong>{getRoleLabel(role)}</strong>
      </div>

      <div className={cx('profileIdentityRow')}>
        <span>이메일</span>
        <div className={cx('profileEmailValue')}>
          <strong className={cx('profileEmailText')}>{userEmail}</strong>
          <span className={cx('profileVerifiedBadge')}>✓ 인증됨</span>
        </div>
      </div>
    </>
  );
}

function LogoutButton() {
  const { mutate: logoutMutate, isPending: isLoggingOut } = useLogoutMutation();
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));

  const handleLogout = () => {
    if (isLoggingOut) return;

    openModal(
      <CommonModal
        type="warning"
        tone="guardian"
        title="로그아웃 확인"
        message="정말 로그아웃할까요?"
        primaryButton={{
          text: isLoggingOut ? '로그아웃 중...' : '로그아웃',
          disabled: isLoggingOut,
          onClick: () => {
            if (isLoggingOut) return;
            logoutMutate();
          },
        }}
        secondaryButton={{ text: '취소', onClick: onCloseModal }}
        onClose={onCloseModal}
      />,
    );
  };

  return (
    <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={handleLogout}>
      {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}

export function ProfileModal({ onClose, profile, role, userId, userEmail, userName }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const controlsRef = useRef<ProfileModalControlsHandle>(null);

  return (
    <div className={cx('profileModalOverlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('profileModal', { profileModalWard: role === 'WARD' })}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={cx('profileModalTitleBar')}>
          <span>내 프로필</span>
          <button className={cx('profileModalClose')} type="button" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={cx('profileModalBody')}>
          <ProfileHeader profile={profile} role={role} userId={userId} userEmail={userEmail} userName={userName} />
          <ProfileModalControls
            key={getProfileControlsKey(profile)}
            ref={controlsRef}
            isEditing={isEditing}
            profile={profile}
            setIsEditing={setIsEditing}
          />
        </div>

        <div className={cx('profileModalFooter')}>
          <button className={cx('profileModalGhostButton')} type="button" onClick={() => controlsRef.current?.toggleEdit()}>
            {isEditing ? '수정 취소' : '정보 수정'}
          </button>
          <LogoutButton />
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
