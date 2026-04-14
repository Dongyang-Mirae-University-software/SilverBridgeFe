'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import EmailVerification from '@/app/(auth)/signup/_components/EmailVerification';
import Step from '@/app/(auth)/_components/Step';
import { findEmail, smsSend, smsVerify } from '@/service/api/auth';
import { IFindEmailResponse } from '@/service/interface/auth';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

const STEP_LIST = ['정보 입력', 'SMS 인증', '결과 확인'];

export default function FindEmailContent() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<IFindEmailResponse | null>(null);

  const isValid = useMemo(() => name.trim().length > 0 && phone.trim().length > 0, [name, phone]);

  const { mutateAsync: findEmailMutate, isPending: isFinding } = useMutation({
    mutationKey: ['find-email'],
    mutationFn: findEmail,
    onSuccess: response => {
      setResult(response.data);
      setErrorMessage('');
      setStep(3);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || '가입된 계정을 찾지 못했습니다.');
    },
  });

  const { mutateAsync: sendSmsMutate, isPending: isSendingSms } = useMutation({
    mutationKey: ['find-email-sms-send'],
    mutationFn: smsSend,
  });

  const { mutateAsync: verifySmsMutate } = useMutation({
    mutationKey: ['find-email-sms-verify'],
    mutationFn: smsVerify,
  });

  const handleInfoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSendingSms) return;

    setErrorMessage('');
    setResult(null);
    setStep(2);
  };

  const handleSendSms = async () => {
    setErrorMessage('');
    return sendSmsMutate({ phone: phone.trim() });
  };

  const handleVerifySms = async ({ code }: { code: string }) => {
    await verifySmsMutate({ code, phone: phone.trim() });
    await findEmailMutate({ name: name.trim(), phone: phone.trim() });
  };

  const handleBackToInfo = () => {
    setErrorMessage('');
    setStep(1);
  };

  return (
    <section className={cx('container')}>
      <div className={cx('panel')}>
        <div className={cx('header')}>
          <p className={cx('eyebrow')}>Silver Bridge</p>
          <h1 className={cx('title')}>이메일 찾기</h1>
          <p className={cx('description')}>이름과 휴대폰 번호를 입력하고 SMS 인증을 완료하면 가입 이메일을 확인할 수 있습니다.</p>
          <Step step={step} stepList={STEP_LIST} />
        </div>

        {step === 1 && (
          <form className={cx('form')} onSubmit={handleInfoSubmit}>
            <TextInput
              label="이름"
              name="name"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={event => setName(event.target.value)}
            />
            <TextInput
              autoComplete="tel"
              label="휴대폰 번호"
              name="phone"
              placeholder="숫자만 입력하세요"
              type="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
            />
            {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
            <button className={cx('submitButton')} disabled={!isValid || isSendingSms} type="submit">
              SMS 인증하기
            </button>
          </form>
        )}

        {step === 2 && (
          <div className={cx('verificationSection')}>
            <div className={cx('summaryBox')}>
              <span>{name}</span>
              <span>{phone}</span>
            </div>
            <EmailVerification
              content="휴대폰으로 전송된 인증번호를 입력하세요."
              errorText={errorMessage || '인증번호가 올바르지 않습니다.'}
              onNext={() => undefined}
              onSend={handleSendSms}
              onVerify={handleVerifySms}
            />
            {isFinding && <p className={cx('infoMessage')}>가입된 이메일을 확인하고 있습니다.</p>}
            <button className={cx('backButton')} type="button" onClick={handleBackToInfo}>
              이전 단계로
            </button>
          </div>
        )}

        {step === 3 && result && (
          <div className={cx('resultSection')}>
            <div className={cx('resultBox')}>
              {result.maskedEmail && (
                <p className={cx('resultText')}>
                  가입된 이메일: <strong>{result.maskedEmail}</strong>
                </p>
              )}
              {result.hasKakaoAccount && (
                <p className={cx('resultText')}>카카오 계정이 존재합니다. 카카오 로그인도 확인해보세요.</p>
              )}
              {!result.maskedEmail && !result.hasKakaoAccount && (
                <p className={cx('resultText')}>가입된 계정을 찾지 못했습니다.</p>
              )}
            </div>
            <div className={cx('resultActions')}>
              <button className={cx('submitButton')} type="button" onClick={() => router.push('/login')}>
                로그인하러 가기
              </button>
              <button className={cx('secondaryButton')} type="button" onClick={() => router.push('/find-password')}>
                비밀번호 찾기
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
