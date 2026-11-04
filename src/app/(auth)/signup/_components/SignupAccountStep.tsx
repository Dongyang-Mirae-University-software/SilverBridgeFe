import { FieldErrors, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form';
import classNames from 'classnames/bind';

import styles from './SignupInfoStep.module.css';
import SignupRoleSelector from './SignupRoleSelector';
import TextInput from '@/components/TextInput';
import { SignupFormValues } from '@/hooks/useSignupForm';

const cx = classNames.bind(styles);

interface SignupAccountStepProps {
  allValues: SignupFormValues;
  errors: FieldErrors<SignupFormValues>;
  emailError: boolean;
  emailErrorText?: string;
  isValid: boolean;
  register: UseFormRegister<SignupFormValues>;
  emailField: UseFormRegisterReturn;
  passwordField: UseFormRegisterReturn;
  passwordCheckField: UseFormRegisterReturn;
  onEmailCheck: () => void;
  onNext: () => void;
}

// 1단계(계정): 가입 유형 · 이메일(중복 확인) · 비밀번호 · 비밀번호 확인
export default function SignupAccountStep({
  allValues,
  errors,
  emailError,
  emailErrorText,
  isValid,
  register,
  emailField,
  passwordField,
  passwordCheckField,
  onEmailCheck,
  onNext,
}: SignupAccountStepProps) {
  return (
    <>
      <SignupRoleSelector role={allValues.role} register={register} />
      <TextInput
        variant="auth"
        label="이메일"
        placeholder="example@email.com"
        required
        autoComplete="email"
        {...emailField}
        onBlur={onEmailCheck}
        error={emailError}
        errorText={emailErrorText}
      />
      <TextInput
        variant="auth"
        label="비밀번호"
        placeholder="8자 이상"
        required
        type="password"
        autoComplete="new-password"
        {...passwordField}
        error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
        errorText={errors.password?.message}
      />
      <TextInput
        variant="auth"
        label="비밀번호 확인"
        placeholder="비밀번호 다시 입력"
        required
        type="password"
        autoComplete="new-password"
        {...passwordCheckField}
        error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
        errorText={errors.passwordCheck?.message}
      />
      <button className={cx('button')} disabled={!isValid} type="button" onClick={onNext}>
        다음
      </button>
    </>
  );
}
