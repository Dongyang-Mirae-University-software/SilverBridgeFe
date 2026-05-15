'use client';

import { ChangeEvent, useState } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import useTimer from '@/app/_hook/useTimer';
import AuthTimer from './AuthTimer';
import styles from './VerificationCodeForm.module.css';

const cx = classNames.bind(styles);

interface Props {
  content: string;
  errorMessage?: string;
  onResend: () => Promise<unknown>;
  onSubmit: (code: string) => Promise<unknown>;
}

export default function VerificationCodeForm({ content, errorMessage, onResend, onSubmit }: Props) {
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { formattedTime, isExpired, reset } = useTimer(180);

  const handleResend = async () => {
    try {
      setIsSending(true);
      await onResend();
      reset();
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit(code);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCode = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value.length > 6) return;
    setCode(event.target.value);
  };

  return (
    <div className={cx('wrap')}>
      <AuthTimer content={content} isExpired={isExpired} time={formattedTime} />
      <TextInput label="인증번호" maxLength={6} value={code} onChange={handleCode} />
      {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
      <button
        className={cx('primary')}
        disabled={code.length !== 6 || isExpired || isSubmitting}
        type="button"
        onClick={handleSubmit}
      >
        {isSubmitting ? '확인 중...' : '인증 확인'}
      </button>
      <button className={cx('secondary')} disabled={isSending} type="button" onClick={handleResend}>
        {isSending ? '재전송 중...' : '인증번호 재전송'}
      </button>
    </div>
  );
}
