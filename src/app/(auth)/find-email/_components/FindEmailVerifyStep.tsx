'use client';

import classNames from 'classnames/bind';

import VerificationCodeForm from '@/app/(auth)/_components/VerificationCodeForm';
import { IFindEmailReq } from '@/service/interface/auth';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  errorMessage: string;
  form: IFindEmailReq;
  onBack: () => void;
  onResend: () => Promise<unknown>;
  onSubmit: (code: string) => Promise<unknown>;
}

export default function FindEmailVerifyStep({ errorMessage, form, onBack, onResend, onSubmit }: Props) {
  return (
    <div className={cx('section')}>
      <div className={cx('summaryBox')}>
        <span>{form.name}</span>
        <span>{form.phone}</span>
      </div>
      <VerificationCodeForm
        content="휴대폰으로 전송된 인증번호를 입력하세요."
        errorMessage={errorMessage}
        onResend={onResend}
        onSubmit={onSubmit}
      />
      <button className={cx('backButton')} type="button" onClick={onBack}>
        이전 단계로
      </button>
    </div>
  );
}
