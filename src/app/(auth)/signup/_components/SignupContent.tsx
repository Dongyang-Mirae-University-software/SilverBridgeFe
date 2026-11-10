'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { SIGNUP_STEP_LABEL, getSignupSteps } from './signupSteps';
import { getSafeReturnPath } from '@/lib/auth/returnPath';
import { KakaoSignupHandoff, readKakaoSignupHandoff } from '@/lib/auth/kakaoSignupHandoff';

const cx = classNames.bind(styles);

type SignupContentProps = {
  searchParams: {
    kakao?: string;
    returnTo?: string;
  };
};

export default function SignupContent({ searchParams }: SignupContentProps) {
  const router = useRouter();
  const clientSearchParams = useSearchParams();
  const [signupStep, setSignupStep] = useState(1);
  const returnTo = getSafeReturnPath(searchParams.returnTo || clientSearchParams.get('returnTo'));
  const isKakao = (searchParams.kakao || clientSearchParams.get('kakao')) === '1';
  // 카카오 가입 정보는 카카오 로그인 콜백이 이 탭의 sessionStorage 에 넣어 둔다. 서버 렌더·첫 렌더에서는 읽을 수 없어 effect 에서 읽는다
  const [kakaoData, setKakaoData] = useState<KakaoSignupHandoff | undefined>(undefined);

  useEffect(() => {
    if (!isKakao) return;

    const handoff = readKakaoSignupHandoff();
    // 없으면(새 탭으로 열었거나 30분이 지남) 카카오 로그인부터 다시 한다
    // 이미 읽었으면 그대로 둔다(같은 값을 새 객체로 다시 넣으면 다시 그려진다)
    if (handoff) setKakaoData(current => current ?? handoff);
    else router.replace(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login');
  }, [isKakao, returnTo, router]);

  const steps = getSignupSteps(isKakao);
  const stepKey = steps[signupStep - 1] ?? steps[0];

  if (isKakao && !kakaoData) return null;

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
