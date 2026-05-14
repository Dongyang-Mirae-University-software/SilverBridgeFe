'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import KakaoSignupForm from './KakaoSignupForm';
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
    <>
      <div className={cx('progress')} aria-hidden="true">
        <span />
        <span />
      </div>

      <div className={cx('header')}>
        <h1 className={cx('title')}>회원가입</h1>
        <p className={cx('description')}>{isKakao ? '전화번호 인증으로 마무리할게요' : '기본 정보를 입력해 주세요'}</p>
      </div>

      <div className={cx('content')}>
        {isKakao && kakaoData ? <KakaoSignupForm kakaoData={kakaoData} /> : <SignupForm />}
      </div>

      <div className={cx('footer')}>
        이미 계정이 있으신가요?{' '}
        <button className={cx('loginLink')} type="button" onClick={() => router.push('/login')}>
          로그인
        </button>
      </div>
    </>
  );
}
