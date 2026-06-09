'use client';

import { ChangeEvent, useState } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/components/TextInput';
import useTimer from '@/hooks/useTimer';
import AuthTimer from './AuthTimer';
import styles from './VerificationCodeForm.module.css';
const cx = classNames.bind(styles);

interface Props {
  codeLength?: number;
  content: string;
  errorMessage?: string;
  expiresInSeconds?: number;
  onResend: () => Promise<unknown>;
  onSubmit: (code: string) => Promise<unknown>;
}

export default function VerificationCodeForm({
  codeLength = 6,
  content,
  errorMessage,
  expiresInSeconds = 300,
  onResend,
  onSubmit,
}: Props) {
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { formattedTime, isExpired, reset } = useTimer(expiresInSeconds);

  const handleResend = async () => {
    try {
      setIsSending(true);
      await onResend();
      setCode('');
      reset();
    } catch {
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit(code);
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCode = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '');
    if (value.length > codeLength) return;
    setCode(value);
  };

  return (
    <div className={cx('wrap')}>
      <AuthTimer content={content} isExpired={isExpired} time={formattedTime} />
      <TextInput inputMode="numeric" label="인증번호" maxLength={codeLength} value={code} onChange={handleCode} />
      {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
      <button
        className={cx('primary')}
        disabled={code.length !== codeLength || isExpired || isSubmitting}
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
