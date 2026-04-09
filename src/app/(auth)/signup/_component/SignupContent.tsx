'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { useState } from 'react';
import EmailVerification from './EmailVerification';
import useSignupForm from '@/app/_hook/useSignupForm';
import Step from '../../_components/Step';

const cx = classNames.bind(styles);
const STEP_LABELS = ['정보 입력', '이메일 인증', '가입 완료'];

export default function SignupContent() {
  const [step, setStep] = useState<number>(2);
  const signupForm = useSignupForm();

  return (
    <div className={cx('sign-wrap')}>
      <div>
        <h1> 회원가입</h1>
        <Step step={step} stepList={STEP_LABELS} />
      </div>
      <div className={cx('contnet')}>
        {step === 1 && <SignupForm signupForm={signupForm} onNext={() => setStep(2)} />}
        {step === 2 && <EmailVerification signupForm={signupForm} />}
        {/* {step === 3 && <SignupComplete />} */}
      </div>
    </div>
  );
}
