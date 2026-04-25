'use client';

import classNames from 'classnames/bind';

import VerificationCodeForm from '@/app/(auth)/_components/VerificationCodeForm';
import styles from './FindPasswordContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  errorMessage: string;
  onResend: () => Promise<unknown>;
  onSubmit: (code: string) => Promise<unknown>;
}

export default function FindPasswordVerifyStep({ errorMessage, onResend, onSubmit }: Props) {
  return (
    <div className={cx('section')}>
      <VerificationCodeForm
        content="받은 인증코드를 입력하세요."
        errorMessage={errorMessage}
        onResend={onResend}
        onSubmit={onSubmit}
      />
    </div>
  );
}