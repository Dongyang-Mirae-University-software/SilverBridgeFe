'use client';

import { usePathname } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './Footer.module.css';

const cx = classNames.bind(styles);
const AUTH_PATHS = ['/login', '/signup', '/find-email', '/find-password', '/auth'];

export default function Footer() {
  const pathname = usePathname();

  if (AUTH_PATHS.some(path => pathname.startsWith(path))) return null;

  return (
    <footer className={cx('footer')}>
      <p className={cx('text')}>Silver Bridge · 안전하고 편리한 커뮤니티</p>
      <p className={cx('legal')}>&copy; {new Date().getFullYear()} Silver Bridge</p>
    </footer>
  );
}
