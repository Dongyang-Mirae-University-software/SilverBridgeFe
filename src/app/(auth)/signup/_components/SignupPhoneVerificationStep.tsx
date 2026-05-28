import classNames from 'classnames/bind';
import { ChangeEvent } from 'react';
import { FieldErrors, UseFormRegisterReturn } from 'react-hook-form';

import styles from './SignupForm.module.css';
import SignupSmsCodeFields from './SignupSmsCodeFields';
import TextInput from '@/components/TextInput';
import { SignupFormValues } from '@/hooks/useSignupForm';

const cx = classNames.bind(styles);

interface SignupPhoneVerificationStepProps {
  allValues: SignupFormValues;
  errors: FieldErrors<SignupFormValues>;
  phoneField: UseFormRegisterReturn;
  smsCode: string;
  smsSendErrorMsg: string;
  smsVerifyError: Error | null;
  isCode: boolean;
  isEmailCheck: boolean;
  isSmsCheck: boolean;
  isSmsSendPending: boolean;
  isSmsVerifyPending: boolean;
  smsTimerKey: number;
  onCodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPhoneChange: (value: string) => void;
  onPhoneCheck: () => void;
  onPhoneReset: () => void;
  onPrevStep: () => void;
  onSmsVerify: () => void;
}

export default function SignupPhoneVerificationStep({
  allValues,
  errors,
  phoneField,
  smsCode,
  smsSendErrorMsg,
  smsVerifyError,
  isCode,
  isEmailCheck,
  isSmsCheck,
  isSmsSendPending,
  isSmsVerifyPending,
  smsTimerKey,
  onCodeChange,
  onPhoneChange,
  onPhoneCheck,
  onPhoneReset,
  onPrevStep,
  onSmsVerify,
}: SignupPhoneVerificationStepProps) {
  const phoneHasValue = allValues.phone.trim().length > 0;
  const hasPhoneError = Boolean(errors.phone && phoneHasValue);
  const canRequestCode = phoneHasValue && !hasPhoneError && !isSmsSendPending;
  const phoneErrorText =
    smsSendErrorMsg || (allValues.phone && allValues.phone.trim() !== '' ? errors.phone?.message : undefined);
  const smsVerifyErrorMessage = smsVerifyError
    ? smsVerifyError.message || '인증번호가 올바르지 않습니다.'
    : undefined;

  return (
    <>
      <div className={cx('phoneVerification')}>
        <div className={cx('phoneActionRow')}>
          <div className={cx('fieldGrow')}>
            <TextInput
              label="전화번호"
              placeholder="01012345678"
              required
              inputMode="numeric"
              maxLength={11}
              {...phoneField}
              value={allValues.phone}
              onChange={event => onPhoneChange(event.target.value)}
              error={Boolean(hasPhoneError || smsSendErrorMsg)}
              disabled={isCode}
              errorText={phoneErrorText}
            />
          </div>
          {isCode ? (
            <button className={cx('outlineButton')} type="button" onClick={onPhoneReset}>
              번호 변경
            </button>
          ) : (
            <button className={cx('inlineButton')} type="button" disabled={!canRequestCode} onClick={onPhoneCheck}>
              {isSmsSendPending ? '발송 중' : '인증번호 받기'}
            </button>
          )}
        </div>

        {isCode && (
          <div className={cx('codePanel', { complete: isSmsCheck })}>
            {isSmsCheck ? (
              <p className={cx('codeGuide')}>전화번호 인증이 완료되었습니다.</p>
            ) : (
              <SignupSmsCodeFields
                key={smsTimerKey}
                phone={allValues.phone}
                smsCode={smsCode}
                errorMessage={smsVerifyErrorMessage}
                isSubmitting={isSmsVerifyPending}
                expiredMessage="인증 시간이 만료되었습니다. 번호 변경 후 다시 인증번호를 받아주세요."
                onCodeChange={onCodeChange}
                onSubmit={onSmsVerify}
              />
            )}
          </div>
        )}
      </div>
      <label className={cx('terms')}>
        <input type="checkbox" defaultChecked />
        <span>이용약관 · 개인정보 처리방침에 동의합니다</span>
      </label>
      <div className={cx('stepActions')}>
        <button className={cx('prevButton')} type="button" onClick={onPrevStep}>
          이전
        </button>
        <button className={cx('button')} disabled={!isEmailCheck || !isSmsCheck || !allValues.verificationNonce} type="submit">
          가입 완료
        </button>
      </div>
    </>
  );
}
