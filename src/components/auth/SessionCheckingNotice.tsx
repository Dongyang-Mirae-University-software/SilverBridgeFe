'use client';

import classNames from 'classnames/bind';

import styles from './SessionRetryNotice.module.css';

const cx = classNames.bind(styles);

// 만료된 로그인을 갱신하는 동안(최대 10초) 빈 화면 대신 보여 준다. 금방 끝나면 깜빡이지 않도록 조금 늦게 나타난다
export default function SessionCheckingNotice() {
  return (
    <div className={cx('container', 'delayed')} role="status" aria-live="polite">
      <p className={cx('title')}>로그인 상태를 확인하고 있어요</p>
      <p className={cx('description')}>잠시만 기다려 주세요.</p>
    </div>
  );
}
