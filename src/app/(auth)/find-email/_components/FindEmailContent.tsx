'use client';

import { FormEvent } from 'react';
import classNames from 'classnames/bind';

import Step from '@/app/(auth)/_components/Step';
import useFindEmailFlow from '../_hooks/useFindEmailFlow';
import FindEmailInfoStep from './FindEmailInfoStep';
import FindEmailResultStep from './FindEmailResultStep';
import FindEmailVerifyStep from './FindEmailVerifyStep';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);
const STEP_LIST = ['정보 입력', 'SMS 인증', '결과 확인'];

export default function FindEmailContent() {
  const flow = useFindEmailFlow();

  const handleInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await flow.requestCode(flow.form);
  };

  return (
    <section className={cx('container')}>
      <div className={cx('panel')}>
        <div className={cx('header')}>
          <p className={cx('eyebrow')}>Silver Bridge</p>
          <h1 className={cx('title')}>이메일 찾기</h1>
          <p className={cx('description')}>이름과 휴대폰 번호를 입력하고 인증번호를 확인하세요.</p>
          <Step step={flow.step} stepList={STEP_LIST} />
        </div>
        {flow.step === 1 && (
          <FindEmailInfoStep
            errorMessage={flow.errorMessage}
            form={flow.form}
            isPending={flow.isRequesting}
            onChange={flow.setForm}
            onSubmit={handleInfoSubmit}
          />
        )}
        {flow.step === 2 && (
          <FindEmailVerifyStep
            errorMessage={flow.errorMessage}
            form={flow.form}
            onBack={() => flow.setStep(1)}
            onResend={() => flow.requestCode(flow.form)}
            onSubmit={flow.verifyCode}
          />
        )}
        {flow.step === 3 && flow.result && <FindEmailResultStep result={flow.result} />}
      </div>
    </section>
  );
}
