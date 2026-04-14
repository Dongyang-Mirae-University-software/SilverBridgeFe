import classNames from 'classnames/bind';
import styles from './EmailVerification.module.css';
import React, { ChangeEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { eamaillSend, emailVerify } from '@/service/api/auth';
import useContactForm from '@/app/_hook/useSignupForm';
import useTimer from '@/app/_hook/useTimer';
import AuthTimer from '../../_components/AuthTimer';
import TextInput from '@/app/_components/common/TextInput';

const cx = classNames.bind(styles);

type SignupFormHook = ReturnType<typeof useContactForm>;
interface IProps {
  signupForm: SignupFormHook;
  onNext: () => void;
}
export default function EmailVerification({ signupForm, onNext }: IProps) {
  const [code, setCode] = useState<string>('');
  const { getValues } = signupForm;
  // TODO: 테스트를 위한 시간 설정, 추후 수정
  const { formattedTime, isExpired, reset } = useTimer(10);

  // const { openModal, closeModal } = useModalStore();
  const { mutate } = useMutation({
    mutationKey: ['eamaill-send'],
    mutationFn: eamaillSend,
  });

  const {
    mutate: verifyMutate,
    isError,
    data,
  } = useMutation({
    mutationKey: ['eamaill-verify'],
    mutationFn: emailVerify,
    onError: () => {
      setCode('');
    },
    onSuccess: () => {
      onNext();
    },
  });

  const handleVerify = async () => {
    const body = {
      email: getValues('email'),
      code,
    };

    await verifyMutate(body);
  };

  const handleResend = async () => {
    await mutate({ email: getValues('email') });

    reset();
  };

  const handleCode = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (code.length >= 6) return;
    setCode(value);
  };

  useEffect(() => {
    handleResend();
  }, []);

  return (
    <>
      <AuthTimer content="Enter the code sent to your email." time={formattedTime} isExpired={isExpired} />
      <TextInput
        error={Boolean(isError)}
        errorText="틀렸어요"
        label="code"
        maxLength={6}
        value={code}
        onChange={handleCode}
        placeholder="코드를 입력하세요."
      />
      <div className={cx('btn-wrap')}>
        <button type="button" className={cx('btn-black')} disabled={code.length !== 6} onClick={handleVerify}>
          <span>검증</span>
        </button>
        <button type="button" className={cx('btn-line')} onClick={handleResend}>
          <span>재전송</span>
        </button>
      </div>
    </>
  );
}
