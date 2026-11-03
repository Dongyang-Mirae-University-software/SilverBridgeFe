'use client';

import { useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { getProviderLabel } from '@/utils/dashboard/profile';
import { getRoleLabel } from '@/utils/auth/routes';
import { ProfileModalControls, ProfileModalControlsHandle } from './ProfileModalControls';
import { ProfileModalFooter } from './ProfileModalFooter';
import { ProfileModalShell } from './ProfileModalShell';
import { RoleProfileModalProps } from './profileModalTypes';
import styles from './GuardianProfileModal.module.css';

const cx = classNames.bind(styles);

export function GuardianProfileModal({ onClose, profile, role, userId, userEmail, userName }: RoleProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const controlsRef = useRef<ProfileModalControlsHandle>(null);

  return (
    <ProfileModalShell
      role={role}
      onClose={onClose}
      footer={<ProfileModalFooter onClose={onClose} actionLabel="정보 수정" isEditing={isEditing} onAction={() => controlsRef.current?.toggleEdit()} />}
    >
      <section className={cx('identity')}>
        <UserAvatar size="w-72" imageUrl={profile?.profileImage} userName={userName} isChange isDelete />
        <div className={cx('identityText')}>
          <h2>{userName}</h2>
          <p>회원 ID · <strong>{userId}</strong></p>
        </div>
        <span className={cx('provider')}>{getProviderLabel(profile?.provider)}</span>
      </section>
      <dl className={cx('summary')}>
        <div><dt>가입 유형</dt><dd>{getRoleLabel(role)}</dd></div>
        <div><dt>이메일</dt><dd>{userEmail}<em>✓ 인증됨</em></dd></div>
      </dl>
      <ProfileModalControls ref={controlsRef} isEditing={isEditing} profile={profile} setIsEditing={setIsEditing} />
    </ProfileModalShell>
  );
}
