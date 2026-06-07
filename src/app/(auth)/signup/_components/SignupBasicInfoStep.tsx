import { FieldErrors, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form';
import classNames from 'classnames/bind';

import styles from './SignupBasicInfoStep.module.css';
import SignupRoleSelector from './SignupRoleSelector';
import TextInput from '@/components/TextInput';
import { SignupFormValues } from '@/hooks/useSignupForm';

const cx = classNames.bind(styles);


interface SignupBasicInfoStepProps {
  allValues: SignupFormValues;
  errors: FieldErrors<SignupFormValues>;
  emailError: boolean;
  emailErrorText?: string;
  isStepOneValid: boolean;
  isKakaoSignup?: boolean;
  register: UseFormRegister<SignupFormValues>;
  nameField: UseFormRegisterReturn;
  emailField: UseFormRegisterReturn;
  passwordField: UseFormRegisterReturn;
  passwordCheckField: UseFormRegisterReturn;
  addressField: UseFormRegisterReturn;
  addressDetailField: UseFormRegisterReturn;
  birthDateField: UseFormRegisterReturn;
  postcodeField: UseFormRegisterReturn;
  onAddressSearch: () => void;
  onEmailCheck: () => void;
  onNextStep: () => void;
}

export default function SignupBasicInfoStep({
  allValues,
  errors,
  emailError,
  emailErrorText,
  isStepOneValid,
  isKakaoSignup = false,
  register,
  nameField,
  emailField,
  passwordField,
  passwordCheckField,
  addressField,
  addressDetailField,
  birthDateField,
  postcodeField,
  onAddressSearch,
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
        disabled={isKakaoSignup}
        readOnly={isKakaoSignup}
        onBlur={isKakaoSignup ? undefined : onEmailCheck}
        error={isKakaoSignup ? false : emailError}
        errorText={isKakaoSignup ? undefined : emailErrorText}
      />
      {!isKakaoSignup && (
        <>
          <TextInput
            label="비밀번호"
            placeholder="8자 이상"
            required
            type="password"
            {...passwordField}
            error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
            errorText={errors.password?.message}
          />
          <TextInput
            label="비밀번호 확인"
            placeholder="비밀번호 다시 입력"
            required
            type="password"
            {...passwordCheckField}
            error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
            errorText={errors.passwordCheck?.message}
          />
        </>
      )}
      <div className={cx('fieldGroup')}>
        <label className={cx('selectField')}>
          <span className={cx('selectLabel')}>성별 *</span>
          <span className={cx('selectBox')}>
            <select {...register('gender')}>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
            </select>
          </span>
        </label>
        <TextInput
          label="생년월일"
          required
          type="date"
          {...birthDateField}
          error={Boolean(errors.birthDate && allValues.birthDate && allValues.birthDate.trim() !== '')}
          errorText={errors.birthDate?.message}
        />
      </div>
      <div className={cx('addressSearchRow')}>
        <TextInput
          label="우편번호"
          placeholder="주소 검색"
          required
          inputMode="numeric"
          maxLength={10}
          readOnly
          {...postcodeField}
          error={Boolean(errors.postcode && allValues.postcode && allValues.postcode.trim() !== '')}
          errorText={errors.postcode?.message}
        />
        <button className={cx('addressSearchButton')} type="button" onClick={onAddressSearch}>
          주소 검색
        </button>
      </div>
      <TextInput
        label="주소"
        placeholder="주소 검색으로 입력하세요"
        required
        readOnly
        {...addressField}
        error={Boolean(errors.address && allValues.address && allValues.address.trim() !== '')}
        errorText={errors.address?.message}
      />
      <TextInput
        label="상세주소"
        placeholder="상세주소를 입력하세요"
        required
        {...addressDetailField}
        error={Boolean(errors.addressDetail && allValues.addressDetail && allValues.addressDetail.trim() !== '')}
        errorText={errors.addressDetail?.message}
      />
      <button className={cx('button')} disabled={!isStepOneValid} type="button" onClick={onNextStep}>
        다음
      </button>
    </>
  );
}
