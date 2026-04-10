import classNames from 'classnames/bind';
import styles from './EmailVerification.module.css';
import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { eamaillSend, emailVerify } from '@/service/api/auth';
import useContactForm from '@/app/_hook/useSignupForm';
import useTimer from '@/app/_hook/useTimer';
import AuthTimer from '../../_components/AuthTimer';

const cx = classNames.bind(styles);

type SignupFormHook = ReturnType<typeof useContactForm>;
interface IProps {
  signupForm: SignupFormHook;
}
export default function EmailVerification({ signupForm }: IProps) {
  const [code, setCode] = useState<string>('');
  const { getValues } = signupForm;
  // TODO: 테스트를 위한 시간 설정, 추후 수정
  const { formattedTime, isExpired, reset } = useTimer(10);

  // const { openModal, closeModal } = useModalStore();
  const { mutate } = useMutation({
    mutationKey: ['eamaill-send'],
    mutationFn: eamaillSend,
  });

  const { mutateAsync: verifyMutate } = useMutation({
    mutationKey: ['eamaill-verify'],
    mutationFn: emailVerify,
  });

  const handleVerify = () => {
    const body = {
      email: getValues('email'),
      code,
    };

    verifyMutate(body, {
      onSuccess: () => {},
      onError: () => {
        setCode('');
      },
    });
  };

  const handleResend = async () => {
    await mutate(
      { email: getValues('email') },
      {
        onSuccess: () => {},
        onError: () => {
          setCode('');
        },
      },
    );

    reset();
  };

  useEffect(() => {
    handleResend();
  }, []);

  return (
    <>
      <AuthTimer content="Enter the code sent to your email." time={formattedTime} isExpired={isExpired} />
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
