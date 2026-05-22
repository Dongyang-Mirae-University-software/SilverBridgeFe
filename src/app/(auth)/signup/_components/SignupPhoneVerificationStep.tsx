import classNames from 'classnames/bind';
import { ChangeEvent } from 'react';
import { FieldErrors, UseFormRegisterReturn } from 'react-hook-form';

import styles from './SignupForm.module.css';
import TextInput from '@/app/_components/common/TextInput';
import { SignupFormValues } from '@/app/_hook/useSignupForm';

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
  onCodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
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
  onCodeChange,
  onPhoneCheck,
  onPhoneReset,
  onPrevStep,
  onSmsVerify,
}: SignupPhoneVerificationStepProps) {
  const phoneHasValue = allValues.phone.trim().length > 0;
  const hasPhoneError = Boolean(errors.phone && phoneHasValue);
  const canRequestCode = phoneHasValue && !hasPhoneError && !isSmsSendPending;
  const canVerifyCode = smsCode.length === 6 && !isSmsCheck && !isSmsVerifyPending;
  const phoneErrorText =
    smsSendErrorMsg || (allValues.phone && allValues.phone.trim() !== '' ? errors.phone?.message : undefined);

  return (
    <>
      <div className={cx('phoneVerification')}>
        <div className={cx('phoneActionRow')}>
          <div className={cx('fieldGrow')}>
            <TextInput
              label="전화번호"
              placeholder="010-0000-0000"
              required
              {...phoneField}
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
            <p className={cx('codeGuide')}>
              {isSmsCheck ? '전화번호 인증이 완료되었습니다.' : `${allValues.phone}으로 인증번호를 보냈습니다.`}
            </p>
            {!isSmsCheck && (
              <div className={cx('codeActionRow')}>
                <div className={cx('fieldGrow')}>
                  <TextInput
                    error={Boolean(smsVerifyError)}
                    errorText={smsVerifyError ? smsVerifyError.message || '인증번호가 올바르지 않습니다.' : undefined}
                    label="인증번호"
                    maxLength={6}
                    value={smsCode}
                    onChange={onCodeChange}
                    placeholder="6자리 입력"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                <button className={cx('inlineButton')} type="button" disabled={!canVerifyCode} onClick={onSmsVerify}>
                  {isSmsVerifyPending ? '확인 중' : '확인'}
                </button>
              </div>
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
