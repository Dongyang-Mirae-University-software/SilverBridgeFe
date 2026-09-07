'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import Step from '@/app/(auth)/_components/Step';
import useFindPasswordFlow from '../_hooks/useFindPasswordFlow';
import FindPasswordMethodStep from './FindPasswordMethodStep';
import FindPasswordEmailStep from './FindPasswordEmailStep';
import FindPasswordSmsStep from './FindPasswordSmsStep';
import FindPasswordVerifyStep from './FindPasswordVerifyStep';
import FindPasswordResetStep from './FindPasswordResetStep';
import styles from './FindPasswordContent.module.css';

const cx = classNames.bind(styles);

const STEP_LIST = ['방식 선택', '정보 입력', '인증 확인', '새 비밀번호 생성'];

export default function FindPasswordContent() {
  const flow = useFindPasswordFlow();
  const router = useRouter();
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  const handleMethodSelect = (method: 'email' | 'sms') => {
    flow.setMethod(method);
    flow.setStep(2);
  };
  const handleKakaoLogin = () => {
    window.location.href = '/api/oauth/kakao/authorize';
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await flow.sendEmail({ email: flow.email });
      flow.setStep(3);
    } catch {
    }
  };

  const handleSmsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await flow.sendSms({ name: flow.name, phone: flow.phone });
      flow.setStep(3);
    } catch {
    }
  };

  const handleVerifySubmit = async (code: string) => {
    const isVerified = await flow.verifyCode(
      flow.method === 'email' ? { email: flow.email, code } : { phone: flow.phone, code },
    );

    if (isVerified) {
      flow.setStep(4);
    }
  };

  const handleResetSubmit = async (newPassword: string) => {
    try {
      await flow.resetPassword(
        flow.method === 'email'
          ? { email: flow.email, code: flow.verifiedCode, newPassword }
          : { phone: flow.phone, code: flow.verifiedCode, newPassword },
      );
      setIsCompleteModalOpen(true);
    } catch {
    }
  };

  return (
    <>
      {isCompleteModalOpen && (
        <CommonModal
          type="success"
          title="비밀번호가 변경되었습니다"
          message="새 비밀번호로 다시 로그인해주세요."
          primaryButton={{ text: '로그인하기', onClick: () => router.push('/login') }}
          onClose={() => router.push('/login')}
        />
      )}
      <div className={cx('header')}>
        <h1 className={cx('title')}>비밀번호 찾기</h1>
        <button className={cx('closeButton')} type="button" onClick={() => router.push('/login')}>
          ✕
        </button>
      </div>
      <Step step={flow.step} stepList={STEP_LIST} />
      {flow.step === 1 && <FindPasswordMethodStep onSelectMethod={handleMethodSelect} />}
      {flow.step === 2 && flow.method === 'email' && (
        <FindPasswordEmailStep
          email={flow.email}
          errorMessage={flow.errorMessage}
          isPending={flow.isSending}
          onChange={flow.setEmail}
          onFindEmail={() => router.push('/find-email')}
          onKakaoLogin={handleKakaoLogin}
          onSignup={() => router.push('/signup')}
          onSubmit={handleEmailSubmit}
          onResend={flow.step > 2 ? () => flow.resendEmail({ email: flow.email }) : undefined}
        />
      )}
      {flow.step === 2 && flow.method === 'sms' && (
        <FindPasswordSmsStep
          name={flow.name}
          phone={flow.phone}
          errorMessage={flow.errorMessage}
          isPending={flow.isSending}
          onChange={(field, value) => field === 'name' ? flow.setName(value) : flow.setPhone(value)}
          onKakaoLogin={handleKakaoLogin}
          onSignup={() => router.push('/signup')}
          onSubmit={handleSmsSubmit}
          onResend={flow.step > 2 ? () => flow.resendSms({ name: flow.name, phone: flow.phone }) : undefined}
        />
      )}
      {flow.step === 3 && (
        <FindPasswordVerifyStep
          errorMessage={flow.errorMessage}
          codeLength={flow.verificationConfig.codeLength}
          expiresInSeconds={flow.verificationConfig.expiresInSeconds}
          onResend={flow.method === 'email' ? () => flow.resendEmail({ email: flow.email }) : () => flow.resendSms({ name: flow.name, phone: flow.phone })}
          onSubmit={handleVerifySubmit}
        />
      )}
      {flow.step === 4 && (
        <FindPasswordResetStep
          errorMessage={flow.errorMessage}
          isPending={flow.isResetting}
          onSubmit={handleResetSubmit}
        />
      )}
    </>
  );
}
