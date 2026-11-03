'use client';

import { useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { getProviderLabel } from '@/utils/dashboard/profile';
import { ProfileModalControls, ProfileModalControlsHandle } from './ProfileModalControls';
import { ProfileModalFooter } from './ProfileModalFooter';
import { ProfileModalShell } from './ProfileModalShell';
import { RoleProfileModalProps } from './profileModalTypes';
import styles from './AdminProfileModal.module.css';

const cx = classNames.bind(styles);

export function AdminProfileModal({ onClose, profile, role, userId, userEmail, userName }: RoleProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const controlsRef = useRef<ProfileModalControlsHandle>(null);

  return (
    <ProfileModalShell
      role={role}
      onClose={onClose}
      footer={<ProfileModalFooter onClose={onClose} actionLabel="운영자 정보 수정" isEditing={isEditing} onAction={() => controlsRef.current?.toggleEdit()} />}
    >
      <section className={cx('hero')}>
        <UserAvatar size="w-72" imageUrl={profile?.profileImage} userName={userName} isChange isDelete />
        <div>
          <span className={cx('roleBadge')}><Icon name="settings" size={14} decorative /> 관리자</span>
          <h2>{userName}</h2>
          <p>{userEmail}</p>
        </div>
      </section>
      <section className={cx('accessCard')}>
        <div className={cx('accessIcon')}><Icon name="lock" size={19} decorative /></div>
        <div><strong>운영자 계정</strong><p>서비스 운영과 관리 기능에 접근할 수 있어요.</p></div>
      </section>
      <dl className={cx('meta')}>
        <div><dt>회원 ID</dt><dd>{userId}</dd></div>
        <div><dt>가입 방식</dt><dd>{getProviderLabel(profile?.provider)}</dd></div>
      </dl>
      <ProfileModalControls ref={controlsRef} isEditing={isEditing} profile={profile} setIsEditing={setIsEditing} />
    </ProfileModalShell>
  );
}
