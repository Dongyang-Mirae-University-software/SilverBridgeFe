'use client';

import { useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getRoleLabel } from '@/utils/auth/routes';
import { ProfileModalControls, ProfileModalControlsHandle } from './ProfileModalControls';
import { ProfileModalFooter } from './ProfileModalFooter';
import { ProfileModalShell } from './ProfileModalShell';
import { WardIdSharePanel } from './WardIdSharePanel';
import { RoleProfileModalProps } from './profileModalTypes';
import styles from './WardProfileModal.module.css';

const cx = classNames.bind(styles);

export function WardProfileModal({ onClose, profile, role, userId, userName, userEmail }: RoleProfileModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const controlsRef = useRef<ProfileModalControlsHandle>(null);

  const handleAction = () => {
    if (!showDetails) {
      setShowDetails(true);
      return;
    }
    controlsRef.current?.toggleEdit();
  };

  return (
    <ProfileModalShell
      role={role}
      onClose={onClose}
      footer={<ProfileModalFooter onClose={onClose} actionLabel="정보 바꾸기" isEditing={isEditing} onAction={handleAction} />}
    >
      {!showDetails ? (
        <>
          <section className={cx('quickIdentity')}>
            <UserAvatar size="w-76" imageUrl={profile?.profileImage} userName={userName} />
            <div>
              <h2>{userName}</h2>
              <p>{profile?.phone || '전화번호 정보 없음'}</p>
            </div>
          </section>
          <WardIdSharePanel userId={userId} />
          <p className={cx('quickGuide')}>가족이 링크를 열고 관계를 고른 뒤 직접 요청하면 연결돼요.</p>
        </>
      ) : (
        <>
          <section className={cx('detailHero')}>
            <UserAvatar size="w-120" imageUrl={profile?.profileImage} userName={userName} isChange isDelete />
            <h2>{userName}</h2>
            <span>{getRoleLabel(role)}</span>
          </section>
          <ProfileModalControls ref={controlsRef} isEditing={isEditing} profile={profile} setIsEditing={setIsEditing} />
          <WardIdSharePanel userId={userId} />
          <p className={cx('email')}>{userEmail}</p>
        </>
      )}
    </ProfileModalShell>
  );
}
