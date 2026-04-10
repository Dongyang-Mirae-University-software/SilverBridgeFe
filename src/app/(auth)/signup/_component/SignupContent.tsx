'use client';

import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';
import { useState } from 'react';
import EmailVerification from './EmailVerification';
import useSignupForm from '@/app/_hook/useSignupForm';
import Step from '../../_components/Step';
import { useRouter } from 'next/navigation';

const cx = classNames.bind(styles);

export default function SignupContent() {
  const router = useRouter();

  const onNext = () => () => router.push('/');

  return (
    <div className={cx('sign-wrap')}>
      <div>
        <h1> 회원가입</h1>
      </div>
      <div className={cx('contnet')}>
        <SignupForm />
      </div>
    </div>
  );
}
