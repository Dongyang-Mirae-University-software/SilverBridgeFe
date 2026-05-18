'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import KakaoSignupForm from './KakaoSignupForm';

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
  const [signupStep, setSignupStep] = useState(1);
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
  const currentStep = isKakao ? 2 : signupStep;

  return (
    <>
      <div className={cx('progress')} aria-hidden="true">
        <span className={cx({ active: currentStep >= 1 })} />
        <span className={cx({ active: currentStep >= 2 })} />
      </div>

      <div className={cx('header')}>
        <h1 className={cx('title')}>회원가입</h1>
        <p className={cx('description')}>
          {currentStep === 1 ? '기본 정보를 입력해 주세요' : '전화번호 인증으로 마무리할게요'}
        </p>
      </div>

      <div className={cx('content')}>
        {isKakao && kakaoData ? (
          <KakaoSignupForm kakaoData={kakaoData} />
        ) : (
          <SignupForm step={signupStep} onStepChange={setSignupStep} />
        )}
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
