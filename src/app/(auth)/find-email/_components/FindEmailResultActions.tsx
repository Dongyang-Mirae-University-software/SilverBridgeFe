'use client';

import { useRouter } from 'next/navigation';

import styles from './FindEmailResultActions.module.css';
const cx = classNames.bind(styles);

export default function FindEmailResultActions() {
  const router = useRouter();

  return (
    <div className={cx('resultActions')}>
      <button className={cx('submitButton')} type="button" onClick={() => router.push('/login')}>
        로그인하기
      </button>
    </div>
  );
}
