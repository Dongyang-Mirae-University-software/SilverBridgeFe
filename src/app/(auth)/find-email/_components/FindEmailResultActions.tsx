'use client';

import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

export default function FindEmailResultActions() {
  const router = useRouter();

  return (
    <div className={cx('resultActions')}>
      <button className={cx('submitButton')} type="button" onClick={() => router.push('/login')}>
        로그인하러 가기
      </button>
      <button className={cx('secondaryButton')} type="button" onClick={() => router.push('/find-password')}>
        비밀번호 찾기
      </button>
    </div>
  );
}