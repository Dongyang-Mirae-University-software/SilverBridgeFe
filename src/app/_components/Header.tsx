'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './Header.module.css';

const cx = classNames.bind(styles);
const AUTH_PATHS = ['/login', '/signup', '/find-email', '/find-password', '/auth'];

export default function Header() {
  const pathname = usePathname();

  if (AUTH_PATHS.some(path => pathname.startsWith(path))) return null;

  return (
    <header className={cx('header')}>
      <div className={cx('brand')}>
        <span className={cx('brandMark')}>SB</span>
        <span>Silver Bridge</span>
      </div>
      <nav className={cx('nav')}>
        <Link className={cx('navLink')} href="/">
          홈
        </Link>
        <Link className={cx('navLink')} href="/login">
          로그인
        </Link>
        <Link className={cx('navLink')} href="/signup">
          회원가입
        </Link>
      </nav>
    </header>
  );
}
