'use client';

import classNames from 'classnames/bind';

import styles from './SessionRetryNotice.module.css';

const cx = classNames.bind(styles);

// 로그인 상태를 확인하지 못했을 때(서버 일시 장애·네트워크 오류) 보여 준다. 세션은 지우지 않는다
export default function SessionRetryNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={cx('container')} role="alert">
      <p className={cx('title')}>로그인 상태를 확인하지 못했어요</p>
      <p className={cx('description')}>잠시 후 다시 시도해 주세요.</p>
      <button className={cx('retryButton')} type="button" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
