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
  onCodeChange,
  onPhoneCheck,
  onPhoneReset,
  onPrevStep,
  onSmsVerify,
}: SignupPhoneVerificationStepProps) {
  const phoneErrorText =
    smsSendErrorMsg || (allValues.phone && allValues.phone.trim() !== '' ? errors.phone?.message : undefined);

  return (
    <>
      <TextInput
        label="전화번호"
        placeholder="010-0000-0000"
        required
        {...phoneField}
        error={Boolean((errors.phone && allValues.phone && allValues.phone.trim() !== '') || smsSendErrorMsg)}
        disabled={isCode}
        errorText={phoneErrorText}
      />
      <div className={cx('actionRow')}>
        <button className={cx('secondaryButton')} type="button" onClick={onPhoneCheck}>
          인증요청
        </button>
        <button className={cx('secondaryButton')} type="button" onClick={onPhoneReset}>
          재설정
        </button>
      </div>
      {isCode && (
        <>
          <TextInput
            error={Boolean(smsVerifyError)}
            errorText={smsVerifyError ? smsVerifyError.message || '인증번호가 올바르지 않습니다.' : undefined}
            label="인증번호"
            maxLength={6}
            value={smsCode}
            onChange={onCodeChange}
            placeholder="6자리 입력"
          />
          <button
            className={cx('secondaryButton')}
            type="button"
            disabled={smsCode.length !== 6 || isSmsCheck}
            onClick={onSmsVerify}
          >
            인증 확인
          </button>
          {isSmsCheck && <p className={cx('verifySuccess')}>인증이 완료되었습니다.</p>}
        </>
      )}
      <label className={cx('terms')}>
        <input type="checkbox" defaultChecked />
        <span>이용약관 · 개인정보 처리방침에 동의합니다</span>
      </label>
      <div className={cx('stepActions')}>
        <button className={cx('prevButton')} type="button" onClick={onPrevStep}>
          이전
        </button>
        <button className={cx('button')} disabled={!isEmailCheck || !isSmsCheck} type="submit">
          가입 완료
        </button>
      </div>
    </>
  );
}
