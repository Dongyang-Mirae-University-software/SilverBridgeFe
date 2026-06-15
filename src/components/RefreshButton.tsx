import { useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import styles from './RefreshButton.module.css';

const cx = classNames.bind(styles);

type RefreshButtonProps = {
  onRefresh: () => Promise<unknown> | void;
  ariaLabel?: string;
  disabled?: boolean;
  isRefreshing?: boolean;
  label?: string;
  refreshingLabel?: string;
};

export function RefreshButton({
  onRefresh,
  ariaLabel = '새로고침',
  disabled = false,
  isRefreshing,
  label = '새로고침',
  refreshingLabel = '새로고침 중',
}: RefreshButtonProps) {
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isActive = isRefreshing ?? isManualRefreshing;

  const handleRefresh = async () => {
    if (disabled || isActive) return;
    setIsManualRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  return (
    <button
      className={cx('button')}
      type="button"
      aria-label={isActive ? `${ariaLabel} 중` : ariaLabel}
      disabled={disabled || isActive}
      onClick={handleRefresh}
    >
      <Icon className={cx('icon', { spinning: isActive })} name="refresh" size={18} decorative />
      <span>{isActive ? refreshingLabel : label}</span>
    </button>
  );
}
