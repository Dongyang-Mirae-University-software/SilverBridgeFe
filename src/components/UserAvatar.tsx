import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import styles from './UserAvatar.module.css';

const cx = classNames.bind(styles);

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
      <div className={cx('photoBlock')}>
        <div className={cx('avatar', size)}>{img}</div>
        {onImageChange && (
          <label className={cx('editButton')} aria-label="프로필 이미지 변경">
            <Icon name="avatarEdit" size={17} decorative />
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
            className={cx('deleteButton')}
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
      <button className={cx('avatar', size)} type="button" disabled={disabled} onClick={onClick}>
        {img}
      </button>
    );
  }

  return <div className={cx('avatar', size)}>{img}</div>;
}
