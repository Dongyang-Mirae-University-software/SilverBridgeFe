'use client';

import classNames from 'classnames/bind';
import { useSearchParams } from 'next/navigation';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { useRouter } from 'next/navigation';

const cx = classNames.bind(styles);

export default function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kakaoId = searchParams.get('kakaoId');
  const email = searchParams.get('email');
  const name = searchParams.get('name');
  const profileImageUrl = searchParams.get('profileImageUrl');

  const isKakao = Boolean(kakaoId && email && name);

  return (
    <div className={cx('sign-wrap')}>
      <div>
        <h1> 회원가입</h1>
      </div>
      <div className={cx('contnet')}>
        <SignupForm
          isKakao={isKakao}
          kakaoData={isKakao ? { kakaoId, email, name, profileImageUrl } : undefined}
        />
      </div>
      <button onClick={() => router.push('/login')}>뒤로 가기</button>
    </div>
  );
}
