import Link from 'next/link';
import classNames from 'classnames/bind';

import styles from './Header.module.css';

const cx = classNames.bind(styles);

export default function Header() {
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
