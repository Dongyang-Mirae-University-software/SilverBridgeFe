import { useState } from 'react';
import clsx from 'clsx';

import styles from './RefreshButton.module.css';

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
      className={styles.button}
      type="button"
      aria-label={isActive ? `${ariaLabel} 중` : ariaLabel}
      disabled={disabled || isActive}
      onClick={handleRefresh}
    >
      <svg className={clsx(styles.icon, { [styles.spinning]: isActive })} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
        <path
          d="M20 4v5h-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
      <span>{isActive ? refreshingLabel : label}</span>
    </button>
  );
}
