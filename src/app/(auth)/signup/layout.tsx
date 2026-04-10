import classNames from 'classnames/bind';

import styles from './page.module.css';

const cx = classNames.bind(styles);

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={cx('signup-layout')}>
      <div className={cx('content')}>{children}</div>
    </div>
  );
}
