import { ChangeEvent } from 'react';
import clsx from 'clsx';

import styles from './SignupSmsCodeFields.module.css';
import TextInput from '@/components/TextInput';
import { SIGNUP_SMS_CODE_EXPIRES_SECONDS } from '@/constants/auth';
import useTimer from '@/hooks/useTimer';
import { formatPhoneNumber } from '@/lib/format/phone';

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
      <div className={styles.codeHeader}>
        <p className={styles.codeGuide}>입력하신 번호로 발송했습니다. 문자가 오지 않으면 번호를 확인해주세요.</p>
        <span className={clsx(styles.codeTimer, { [styles.expired]: isExpired })}>{isExpired ? '시간 만료' : formattedTime}</span>
      </div>
      <div className={styles.codeActionRow}>
        <div className={styles.fieldGrow}>
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
        <button className={styles.inlineButton} type="button" disabled={!canVerifyCode} onClick={onSubmit}>
          {isSubmitting ? '확인 중' : '확인'}
        </button>
      </div>
    </>
  );
}
