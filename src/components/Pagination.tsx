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
  totalPages?: number;
  variant?: 'default' | 'numbered';
}

export function Pagination({
  page,
  hasPrevPage,
  hasNextPage,
  disabled = false,
  onChange,
  totalPages,
  variant = 'default',
}: PaginationProps) {
  if (!hasPrevPage && !hasNextPage) return null;

  if (variant === 'numbered' && totalPages) {
    return (
      <div className={cx('pagination', 'numbered')}>
        <button
          className={cx('numberedButton')}
          type="button"
          disabled={!hasPrevPage || disabled}
          onClick={() => onChange(Math.max(0, page - 1))}
        >
          이전
        </button>
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            key={index}
            className={cx('numberedButton', { numberedButtonActive: index === page })}
            type="button"
            disabled={disabled}
            onClick={() => onChange(index)}
          >
            {index + 1}
          </button>
        ))}
        <button
          className={cx('numberedButton')}
          type="button"
          disabled={!hasNextPage || disabled}
          onClick={() => onChange(page + 1)}
        >
          다음
        </button>
      </div>
    );
  }

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
