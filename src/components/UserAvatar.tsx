import clsx from 'clsx';

import styles from './UserAvatar.module.css';

interface UserAvatarProps {
  imageUrl?: string | null;
  size: 'w-60' | 'w-120';
  disabled?: boolean;
  onClick?: () => void;
  onImageChange?: (file?: File) => void;
  onImageDelete?: () => void;
}

export function UserAvatar({ imageUrl, size, disabled, onClick, onImageChange, onImageDelete }: UserAvatarProps) {
  const img = <img alt="" src={imageUrl || '/images/avatar.png'} />;
  const hasEditControls = onImageChange !== undefined || onImageDelete !== undefined;

  if (hasEditControls) {
    return (
      <div className={styles.photoBlock}>
        <div className={clsx(styles.avatar, styles[size])}>{img}</div>
        {onImageChange && (
          <label className={styles.editButton} aria-label="프로필 이미지 변경">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8.5 7.5 10 5h4l1.5 2.5H18a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6.5a3 3 0 0 1 3-3h2.5Z" />
              <path d="M12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
            </svg>
            <input
              type="file"
              accept="image/*"
              disabled={disabled}
              onChange={event => {
                onImageChange(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
        )}
        {onImageDelete && imageUrl && (
          <button
            className={styles.deleteButton}
            type="button"
            aria-label="프로필 이미지 삭제"
            disabled={disabled}
            onClick={event => {
              event.stopPropagation();
              onImageDelete();
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (onClick) {
    return (
      <button className={clsx(styles.avatar, styles[size])} type="button" disabled={disabled} onClick={onClick}>
        {img}
      </button>
    );
  }

  return <div className={clsx(styles.avatar, styles[size])}>{img}</div>;
}
