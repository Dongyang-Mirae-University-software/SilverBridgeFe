'use client';

import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  onBack?: () => void;
}

export default function FindEmailResultActions({ onBack }: Props) {
  const router = useRouter();

  return (
    <div className={cx('resultActions')}>
      {onBack && (
        <button className={cx('backButton')} type="button" onClick={onBack}>
          뒤로 가기
        </button>
      )}
      <button className={cx('submitButton')} type="button" onClick={() => router.push('/login')}>
        로그인하러 가기
      </button>
      <button className={cx('secondaryButton')} type="button" onClick={() => router.push('/find-password')}>
        비밀번호 찾기
      </button>
    </div>
  );
}
