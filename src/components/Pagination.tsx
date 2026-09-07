'use client';

import classNames from 'classnames/bind';

import styles from './Pagination.module.css';

const cx = classNames.bind(styles);

interface PaginationProps {
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
  onChange: (page: number) => void;
}

export function Pagination({ page, hasPrevPage, hasNextPage, disabled = false, onChange }: PaginationProps) {
  if (!hasPrevPage && !hasNextPage) return null;

  return (
    <div className={cx('pagination')}>
      <button
        className={cx('pageButton')}
        type="button"
        disabled={!hasPrevPage || disabled}
        onClick={() => onChange(Math.max(0, page - 1))}
      >
        이전
      </button>
      <span className={cx('pageIndicator')}>{page + 1}</span>
      <button
        className={cx('pageButton')}
        type="button"
        disabled={!hasNextPage || disabled}
        onClick={() => onChange(page + 1)}
      >
        다음
      </button>
    </div>
  );
}
