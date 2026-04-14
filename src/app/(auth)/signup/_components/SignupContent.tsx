'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { useRouter } from 'next/navigation';

const cx = classNames.bind(styles);

export default function SignupContent() {
  const router = useRouter();

  return (
    <div className={cx('sign-wrap')}>
      <div>
        <h1> 회원가입</h1>
      </div>
      <div className={cx('contnet')}>
        <SignupForm />
      </div>
      <button onClick={() => router.push('/login')}>뒤로 가기</button>
    </div>
  );
}
