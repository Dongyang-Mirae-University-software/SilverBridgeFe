'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { useRouter } from 'next/navigation';

const cx = classNames.bind(styles);

type SignupContentProps = {
  searchParams: {
    kakaoId?: string;
    email?: string;
    name?: string;
    profileImageUrl?: string;
  };
};

export default function SignupContent({ searchParams }: SignupContentProps) {
  const router = useRouter();
  const kakaoId = searchParams.kakaoId;
  const email = searchParams.email;
  const name = searchParams.name;
  const profileImageUrl = searchParams.profileImageUrl;

  const isKakao = Boolean(kakaoId && email && name);

  const kakaoData = isKakao
    ? {
        kakaoId: kakaoId!,
        email: email!,
        name: name!,
        profileImageUrl: profileImageUrl || undefined,
      }
    : undefined;

  return (
    <div className={cx('sign-wrap')}>
      <div>
        <h1> 회원가입</h1>
      </div>
      <div className={cx('contnet')}>
        <SignupForm isKakao={isKakao} kakaoData={kakaoData} />
      </div>
      <button onClick={() => router.push('/login')}>뒤로 가기</button>
    </div>
  );
}
