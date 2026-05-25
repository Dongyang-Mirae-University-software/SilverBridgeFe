import classNames from 'classnames/bind';

import styles from './RefreshButton.module.css';

const cx = classNames.bind(styles);

type RefreshButtonProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  ariaLabel?: string;
  label?: string;
  refreshingLabel?: string;
};

export function RefreshButton({
  isRefreshing,
  onRefresh,
  ariaLabel = '새로고침',
  label = '새로고침',
  refreshingLabel = '새로고침 중',
}: RefreshButtonProps) {
  return (
    <button
      className={cx('button')}
      type="button"
      aria-label={isRefreshing ? `${ariaLabel} 중` : ariaLabel}
      disabled={isRefreshing}
      onClick={onRefresh}
    >
      <svg className={cx('icon', { spinning: isRefreshing })} viewBox="0 0 24 24" aria-hidden="true">
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
      <span>{isRefreshing ? refreshingLabel : label}</span>
    </button>
  );
}
