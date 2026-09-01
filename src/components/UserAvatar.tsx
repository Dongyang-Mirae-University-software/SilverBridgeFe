'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { Icon } from '@/components/Icon';
import { useProfileImageChangeMutation, useProfileImageDeleteMutation } from '@/service/query/user';
import styles from './UserAvatar.module.css';

const cx = classNames.bind(styles);

interface UserAvatarProps {
  imageUrl?: string | null;
  size: 'w-32' | 'w-60' | 'w-120';
  disabled?: boolean;
  onClick?: () => void;
  isChange?: boolean;
  isDelete?: boolean;
}

export function UserAvatar({ imageUrl, size, disabled, onClick, isChange = false, isDelete = false }: UserAvatarProps) {
  const [profileImageError, setProfileImageError] = useState('');
  const { mutate: profileImageMutate, isPending: isProfileImageChanging } = useProfileImageChangeMutation({
    onError: message => setProfileImageError(message),
  });
  const { mutate: profileImageDeleteMutate, isPending: isProfileImageDeleting } = useProfileImageDeleteMutation({
    onError: message => setProfileImageError(message),
  });
  const isControlDisabled = disabled || isProfileImageChanging || isProfileImageDeleting;
  const hasEditControls = isChange || isDelete;
  const img = <img alt="" src={imageUrl || '/images/avatar.png'} />;

  const handleProfileImageChange = (file?: File) => {
    if (!file || isControlDisabled) return;
    setProfileImageError('');
    profileImageMutate(file);
  };

  const handleProfileImageDelete = () => {
    if (isControlDisabled || !imageUrl) return;
    if (!window.confirm('프로필 이미지를 삭제할까요?')) return;
    setProfileImageError('');
    profileImageDeleteMutate();
  };

  const handleProfileImageErrorClose = () => setProfileImageError('');
  const avatar = onClick ? (
    <button className={cx('avatar', size)} type="button" disabled={disabled} onClick={onClick}>
      {img}
    </button>
  ) : (
    <div className={cx('avatar', size)}>{img}</div>
  );

  if (!hasEditControls) return avatar;

  return (
    <div className={cx('photoBlock')}>
      {avatar}
      {isChange && (
        <label className={cx('editButton', { disabled: isControlDisabled })} aria-label="프로필 이미지 변경">
          <Icon name="avatarEdit" size={17} decorative />
          <input
            type="file"
            accept="image/*"
            disabled={isControlDisabled}
            onChange={event => {
              handleProfileImageChange(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
      )}
      {isDelete && imageUrl && (
        <button
          className={cx('deleteButton')}
          type="button"
          aria-label="프로필 이미지 삭제"
          disabled={isControlDisabled}
          onClick={event => {
            event.stopPropagation();
            handleProfileImageDelete();
          }}
        >
          ×
        </button>
      )}
      {profileImageError && (
        <CommonModal
          type="error"
          title="프로필 이미지 처리 실패"
          message={profileImageError}
          confirmText="확인"
          onConfirm={handleProfileImageErrorClose}
          onClose={handleProfileImageErrorClose}
        />
      )}
    </div>
  );
}
