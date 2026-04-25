'use client';

import { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import Step from '@/app/(auth)/_components/Step';
import useFindPasswordFlow from '../_hooks/useFindPasswordFlow';
import FindPasswordMethodStep from './FindPasswordMethodStep';
import FindPasswordEmailStep from './FindPasswordEmailStep';
import FindPasswordSmsStep from './FindPasswordSmsStep';
import FindPasswordVerifyStep from './FindPasswordVerifyStep';
import FindPasswordResetStep from './FindPasswordResetStep';
import styles from './FindPasswordContent.module.css';

const cx = classNames.bind(styles);

const STEP_LIST = ['방식 선택', '정보 입력', '인증 확인', '비밀번호 재설정'];

export default function FindPasswordContent() {
  const flow = useFindPasswordFlow();
  const router = useRouter();

  const handleMethodSelect = (method: 'email' | 'sms') => {
    flow.setMethod(method);
    flow.setStep(2);
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await flow.sendEmail({ email: flow.email });
    flow.setStep(3);
  };

  const handleSmsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await flow.sendSms({ name: flow.name, phone: flow.phone });
    flow.setStep(3);
  };

  const handleVerifySubmit = async (code: string) => {
    await flow.verifyCode(flow.method === 'email' ? { token: code } : { phone: flow.phone, code });
    flow.setStep(4);
  };

  const handleResetSubmit = async (newPassword: string) => {
    await flow.resetPassword({ token: flow.token!, newPassword });
    // 성공 시 로그인 페이지로 이동
    router.push('/login');
  };

  return (
    <section className={cx('container')}>
      <div className={cx('panel')}>
        <div className={cx('header')}>
          <button className={cx('backButton')} type="button" onClick={() => router.push('/login')}>
            ← 뒤로 가기
          </button>
          <p className={cx('eyebrow')}>Silver Bridge</p>
          <h1 className={cx('title')}>비밀번호 찾기</h1>
          <p className={cx('description')}>비밀번호를 찾을 방법을 선택하세요.</p>
          <Step step={flow.step} stepList={STEP_LIST} />
        </div>
        {flow.step === 1 && <FindPasswordMethodStep onSelectMethod={handleMethodSelect} />}
        {flow.step === 2 && flow.method === 'email' && (
          <FindPasswordEmailStep
            email={flow.email}
            errorMessage={flow.errorMessage}
            isPending={flow.isSending}
            onChange={flow.setEmail}
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
            onChange={flow.setFormField}
            onSubmit={handleSmsSubmit}
            onResend={flow.step > 2 ? () => flow.resendSms({ name: flow.name, phone: flow.phone }) : undefined}
          />
        )}
        {flow.step === 3 && (
          <FindPasswordVerifyStep
            errorMessage={flow.errorMessage}
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
      </div>
    </section>
  );
}