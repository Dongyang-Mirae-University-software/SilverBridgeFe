import classNames from 'classnames/bind';
import { FieldErrors, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form';

import styles from './SignupForm.module.css';
import SignupRoleSelector from './SignupRoleSelector';
import TextInput from '@/app/_components/common/TextInput';
import { SignupFormValues } from '@/app/_hook/useSignupForm';

const cx = classNames.bind(styles);

interface SignupBasicInfoStepProps {
  allValues: SignupFormValues;
  errors: FieldErrors<SignupFormValues>;
  emailError: boolean;
  emailErrorText?: string;
  isStepOneValid: boolean;
  register: UseFormRegister<SignupFormValues>;
  nameField: UseFormRegisterReturn;
  emailField: UseFormRegisterReturn;
  passwordField: UseFormRegisterReturn;
  passwordCheckField: UseFormRegisterReturn;
  addressField: UseFormRegisterReturn;
  addressDetailField: UseFormRegisterReturn;
  onEmailCheck: () => void;
  onNextStep: () => void;
}

export default function SignupBasicInfoStep({
  allValues,
  errors,
  emailError,
  emailErrorText,
  isStepOneValid,
  register,
  nameField,
  emailField,
  passwordField,
  passwordCheckField,
  addressField,
  addressDetailField,
  onEmailCheck,
  onNextStep,
}: SignupBasicInfoStepProps) {
  return (
    <>
      <SignupRoleSelector role={allValues.role} register={register} />
      <TextInput
        label="이름"
        placeholder="홍길동"
        required
        {...nameField}
        error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
        errorText={errors.name?.message}
      />
      <TextInput
        label="이메일"
        placeholder="example@email.com"
        required
        {...emailField}
        onBlur={onEmailCheck}
        error={emailError}
        errorText={emailErrorText}
      />
      <TextInput
        label="비밀번호"
        placeholder="8자 이상"
        required
        {...passwordField}
        error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
        errorText={errors.password?.message}
      />
      <TextInput
        label="비밀번호 확인"
        placeholder="비밀번호 다시 입력"
        required
        {...passwordCheckField}
        error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
        errorText={errors.passwordCheck?.message}
      />
      <TextInput
        label="주소"
        placeholder="주소를 입력하세요"
        required
        {...addressField}
        error={Boolean(errors.address && allValues.address && allValues.address.trim() !== '')}
        errorText={errors.address?.message}
      />
      <TextInput label="상세주소" placeholder="상세주소를 입력하세요" {...addressDetailField} />
      <button className={cx('button')} disabled={!isStepOneValid} type="button" onClick={onNextStep}>
        다음
      </button>
    </>
  );
}
