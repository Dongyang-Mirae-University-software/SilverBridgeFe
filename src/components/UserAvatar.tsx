import classNames from 'classnames/bind';

import styles from './UserAvatar.module.css';
import Image from 'next/image';

const cx = classNames.bind(styles);

interface UserAvatarProps {
  imageUrl?: string | null;
  size: 'w-60' | 'w-120';
  onClick?: () => void;
}

export function UserAvatar({ imageUrl, size, onClick }: UserAvatarProps) {
  const img = <Image fill alt="" src={imageUrl || '/images/avatar.png'} />;

  if (onClick) {
    return (
      <button className={cx('avatar', size)} type="button" onClick={onClick}>
        {img}
      </button>
    );
  }

  return <div className={cx('avatar', size)}>{img}</div>;
}
