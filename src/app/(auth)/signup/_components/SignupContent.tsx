'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { SIGNUP_STEP_LABEL, getSignupSteps } from './signupSteps';
import { getSafeReturnPath } from '@/lib/auth/returnPath';

const cx = classNames.bind(styles);

type SignupContentProps = {
  searchParams: {
    kakaoId?: string;
    email?: string;
    profileImageUrl?: string;
    returnTo?: string;
  };
};

export default function SignupContent({ searchParams }: SignupContentProps) {
  const router = useRouter();
  const clientSearchParams = useSearchParams();
  const [signupStep, setSignupStep] = useState(1);
  const kakaoId = searchParams.kakaoId || clientSearchParams.get('kakaoId') || '';
  const email = searchParams.email || clientSearchParams.get('email') || '';
  const profileImageUrl = searchParams.profileImageUrl || clientSearchParams.get('profileImageUrl') || '';
  const returnTo = getSafeReturnPath(searchParams.returnTo || clientSearchParams.get('returnTo'));

  const isKakao = Boolean(kakaoId && email);

  const kakaoData = isKakao
    ? {
        kakaoId: kakaoId!,
        email: email!,
        profileImageUrl: profileImageUrl || undefined,
      }
    : undefined;
  const steps = getSignupSteps(isKakao);
  const stepKey = steps[signupStep - 1] ?? steps[0];

  return (
    <>
      <div className={cx('header')} data-auth-screen="signup">
        <h1 className={cx('title')}>회원가입</h1>
        <p className={cx('stepLabel')}>
          <b>{signupStep}</b> / {steps.length} · {SIGNUP_STEP_LABEL[stepKey]}
        </p>
      </div>
      <div className={cx('progress')} aria-hidden="true">
        {steps.map((key, index) => (
          <span key={key} className={cx({ active: index < signupStep })} />
        ))}
      </div>
      <div className={cx('content')}>
        <SignupForm
          step={stepKey}
          onNext={() => setSignupStep(step => Math.min(step + 1, steps.length))}
          onPrev={() => setSignupStep(step => Math.max(step - 1, 1))}
          kakaoData={kakaoData}
          returnTo={returnTo ?? undefined}
        />
      </div>

      <div className={cx('footer')}>
        이미 계정이 있으신가요?{' '}
        <button className={cx('loginLink')} type="button" onClick={() => router.push(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login')}>
          로그인
        </button>
      </div>
    </>
  );
}
