import { ChangeEvent } from 'react';
import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';
import TextInput from '@/components/TextInput';
import { SIGNUP_SMS_CODE_EXPIRES_SECONDS } from '@/constants/auth';
import useTimer from '@/hooks/useTimer';

const cx = classNames.bind(styles);

interface SignupSmsCodeFieldsProps {
  phone: string;
  smsCode: string;
  errorMessage?: string;
  isSubmitting?: boolean;
  expiredMessage: string;
  onCodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}

export default function SignupSmsCodeFields({
  phone,
  smsCode,
  errorMessage,
  isSubmitting = false,
  expiredMessage,
  onCodeChange,
  onSubmit,
}: SignupSmsCodeFieldsProps) {
  const { formattedTime, isExpired } = useTimer(SIGNUP_SMS_CODE_EXPIRES_SECONDS);
  const canVerifyCode = smsCode.length === 6 && !isSubmitting && !isExpired;

  return (
    <>
      <div className={cx('codeHeader')}>
        <p className={cx('codeGuide')}>{phone}으로 인증번호를 보냈습니다.</p>
        <span className={cx('codeTimer', { expired: isExpired })}>{isExpired ? '시간 만료' : formattedTime}</span>
      </div>
      <div className={cx('codeActionRow')}>
        <div className={cx('fieldGrow')}>
          <TextInput
            error={Boolean(errorMessage || isExpired)}
            errorText={isExpired ? expiredMessage : errorMessage}
            label="인증번호"
            maxLength={6}
            value={smsCode}
            onChange={onCodeChange}
            placeholder="6자리 입력"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        <button className={cx('inlineButton')} type="button" disabled={!canVerifyCode} onClick={onSubmit}>
          {isSubmitting ? '확인 중' : '확인'}
        </button>
      </div>
    </>
  );
}
