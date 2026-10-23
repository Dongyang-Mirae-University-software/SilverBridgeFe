'use client';

import classNames from 'classnames/bind';

import styles from './ReservationPager.module.css';

const cx = classNames.bind(styles);

interface Props {
  page: number;
  total: number;
  onChange: (page: number) => void;
  label: string;
}

// 병원 예약 화면의 페이지 버튼: [이전] 1 2 … [다음]. 1페이지 이하면 숨긴다.
export function ReservationPager({ page, total, onChange, label }: Props) {
  if (total <= 1) return null;
  return (
    <nav className={cx('pager')} aria-label={label}>
      <button type="button" className={cx('button')} disabled={page === 0} onClick={() => onChange(page - 1)}>
        이전
      </button>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          className={cx('button', { current: i === page })}
          aria-current={i === page ? 'page' : undefined}
          onClick={() => onChange(i)}
        >
          {i + 1}
        </button>
      ))}
      <button type="button" className={cx('button')} disabled={page === total - 1} onClick={() => onChange(page + 1)}>
        다음
      </button>
    </nav>
  );
}
