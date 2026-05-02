import classNames from 'classnames/bind';

import styles from './Footer.module.css';

const cx = classNames.bind(styles);

export default function Footer() {
  return (
    <footer className={cx('footer')}>
      <p className={cx('text')}>Silver Bridge · 안전하고 편리한 커뮤니티</p>
      <p className={cx('legal')}>&copy; {new Date().getFullYear()} Silver Bridge</p>
    </footer>
  );
}
