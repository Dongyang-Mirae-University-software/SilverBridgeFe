import classNames from 'classnames/bind';

import styles from './GuardianHospitalContent.module.css';

const cx = classNames.bind(styles);

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon')}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'iconLg')}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'iconLg', 'iconMute')}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'checkIcon')}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('icon', 'chevronIcon')}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
