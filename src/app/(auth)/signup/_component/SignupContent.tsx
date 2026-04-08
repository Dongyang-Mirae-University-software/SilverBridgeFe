'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { useState } from 'react';
import EmailVerification from './EmailVerification';
import SignupComplete from './SignupComplete';

const cx = classNames.bind(styles);

export default function SignupContent() {
  const [step, setStep] = useState<number>(2);

  return (
    <div className={cx('sign-wrap')}>
      <div>
        <h1> 회원가입</h1>
        {/* TODO: step구현  */}
        <span>step</span>
      </div>
      <div className={cx('contnet')}>
        {step === 1 && <SignupForm onNext={() => setStep(2)} />}
        {step === 2 && <EmailVerification />}
        {step === 3 && <SignupComplete />}
      </div>
    </div>
  );
}
