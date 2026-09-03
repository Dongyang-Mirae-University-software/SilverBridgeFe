'use client';

import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { Icon } from '@/components/Icon';
import useModalStore from '@/store/modalStore';
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

interface AvatarProps {
  imageUrl?: string | null;
  size: UserAvatarProps['size'];
  disabled?: boolean;
  onClick?: () => void;
}

function Avatar({ imageUrl, size, disabled, onClick }: AvatarProps) {
  const img = <img alt="" src={imageUrl || '/images/avatar.png'} />;

  if (onClick) {
    return (
      <button className={cx('avatar', size)} type="button" disabled={disabled} onClick={onClick}>
        {img}
      </button>
    );
  }

  return <div className={cx('avatar', size)}>{img}</div>;
}

interface EditButtonProps {
  onError: (message: string) => void;
}

function EditButton({ onError }: EditButtonProps) {
  const { mutate: profileImageMutate, isPending } = useProfileImageChangeMutation({ onError });

  const handleChange = (file?: File) => {
    if (!file || isPending) return;
    profileImageMutate(file);
  };

  return (
    <label className={cx('editButton', { disabled: isPending })} aria-label="프로필 이미지 변경">
      <Icon name="avatarEdit" size={17} decorative />
      <input
        type="file"
        accept="image/*"
        disabled={isPending}
        onChange={event => {
          handleChange(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}

interface DeleteButtonProps {
  imageUrl?: string | null;
  onError: (message: string) => void;
}

function DeleteButton({ imageUrl, onError }: DeleteButtonProps) {
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));
  const { mutate: profileImageDeleteMutate, isPending } = useProfileImageDeleteMutation({ onError });

  if (!imageUrl) return null;

  const handleDelete = () => {
    if (isPending) return;

    openModal(
      <CommonModal
        type="warning"
        title="프로필 이미지 삭제"
        message="프로필 이미지를 삭제할까요?"
        confirmText="삭제"
        secondaryText="취소"
        onConfirm={() => {
          onCloseModal();
          profileImageDeleteMutate();
        }}
        onSecondary={onCloseModal}
        onClose={onCloseModal}
      />,
    );
  };

  return (
    <button
      className={cx('deleteButton')}
      type="button"
      aria-label="프로필 이미지 삭제"
      disabled={isPending}
      onClick={event => {
        event.stopPropagation();
        handleDelete();
      }}
    >
      ×
    </button>
  );
}

export function UserAvatar({ imageUrl, size, disabled, onClick, isChange = false, isDelete = false }: UserAvatarProps) {
  const { openModal, onCloseModal } = useModalStore(state => ({
    openModal: state.openModal,
    onCloseModal: state.onCloseModal,
  }));
  const hasEditControls = isChange || isDelete;

  const showErrorModal = (message: string) => {
    openModal(
      <CommonModal
        type="error"
        title="프로필 이미지 처리 실패"
        message={message}
        confirmText="확인"
        onConfirm={onCloseModal}
        onClose={onCloseModal}
      />,
    );
  };

  if (!hasEditControls) return <Avatar imageUrl={imageUrl} size={size} disabled={disabled} onClick={onClick} />;

  return (
    <div className={cx('photoBlock')}>
      <Avatar imageUrl={imageUrl} size={size} disabled={disabled} onClick={onClick} />
      {isChange && <EditButton onError={showErrorModal} />}
      {isDelete && <DeleteButton imageUrl={imageUrl} onError={showErrorModal} />}
    </div>
  );
}
