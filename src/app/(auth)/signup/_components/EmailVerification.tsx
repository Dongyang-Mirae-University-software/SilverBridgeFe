import { ChangeEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import useTimer from '@/app/_hook/useTimer';
import AuthTimer from '../../_components/AuthTimer';
import styles from './EmailVerification.module.css';

const cx = classNames.bind(styles);

interface VerificationPayload {
  code: string;
}

interface EmailVerificationProps {
  content: string;
  errorText?: string;
  label?: string;
  onNext: () => void;
  onSend: () => Promise<unknown>;
  onVerify: (payload: VerificationPayload) => Promise<unknown>;
}

export default function EmailVerification({
  content,
  errorText = '인증번호가 올바르지 않습니다.',
  label = '인증번호',
  onNext,
  onSend,
  onVerify,
}: EmailVerificationProps) {
  const [code, setCode] = useState('');
  const [localErrorMessage, setLocalErrorMessage] = useState('');
  const { formattedTime, isExpired, reset } = useTimer(180);

  const { mutate: sendMutate, isPending: isSending } = useMutation({
    mutationKey: ['verification-send'],
    mutationFn: onSend,
    onError: (error: Error) => {
      setLocalErrorMessage(error.message || '인증번호 전송에 실패했습니다.');
    },
    onSuccess: () => {
      setLocalErrorMessage('');
      reset();
    },
  });

  const { mutate: verifyMutate, isError, isPending: isVerifying } = useMutation({
    mutationKey: ['verification-check'],
    mutationFn: onVerify,
    onError: (error: Error) => {
      setLocalErrorMessage(error.message || errorText);
      setCode('');
    },
    onSuccess: () => {
      setLocalErrorMessage('');
      onNext();
    },
  });

  const handleVerify = () => {
    verifyMutate({ code });
  };

  const handleResend = () => {
    sendMutate();
  };

  const handleCode = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (value.length > 6) return;
    setLocalErrorMessage('');
    setCode(value);
  };

  useEffect(() => {
    sendMutate();
  }, [sendMutate]);

  return (
    <>
      <AuthTimer content={content} isExpired={isExpired} time={formattedTime} />
      <TextInput
        error={Boolean(isError || localErrorMessage)}
        errorText={localErrorMessage || errorText}
        label={label}
        maxLength={6}
        placeholder="인증번호 6자리를 입력하세요."
        value={code}
        onChange={handleCode}
      />
      {localErrorMessage && <p className={cx('errorMessage')}>{localErrorMessage}</p>}
      <div className={cx('btnWrap')}>
        <button
          className={cx('primaryButton')}
          disabled={code.length !== 6 || isExpired || isVerifying}
          type="button"
          onClick={handleVerify}
        >
          {isVerifying ? '확인 중...' : '인증 확인'}
        </button>
        <button className={cx('secondaryButton')} disabled={isSending} type="button" onClick={handleResend}>
          {isSending ? '재전송 중...' : '인증번호 재전송'}
        </button>
      </div>
    </>
  );
}
