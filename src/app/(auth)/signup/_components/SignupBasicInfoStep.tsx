import { FieldErrors, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form';
import classNames from 'classnames/bind';

import styles from './SignupBasicInfoStep.module.css';
import SignupRoleSelector from './SignupRoleSelector';
import TextInput from '@/components/TextInput';
import { SignupFormValues } from '@/hooks/useSignupForm';
import { BirthDateSelects } from '@/components/BirthDateSelects';

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
  genderField: UseFormRegisterReturn;
  addressField: UseFormRegisterReturn;
  addressDetailField: UseFormRegisterReturn;
  birthDateValue: string;
  onBirthDateChange: (value: string) => void;
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
  genderField,
  addressField,
  addressDetailField,
  birthDateValue,
  onBirthDateChange,
  postcodeField,
  onAddressSearch,
  onEmailCheck,
  onNextStep,
}: SignupBasicInfoStepProps) {
  return (
    <>
      <SignupRoleSelector role={allValues.role} register={register} />
      <div className={cx('pair', 'stackOnMobile')}>
        <TextInput
          variant="auth"
          label="이름"
          placeholder="홍길동"
          required
          {...nameField}
          error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
          errorText={errors.name?.message}
        />
        <TextInput
          variant="auth"
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
      </div>
      {!isKakaoSignup && (
        <div className={cx('pair')}>
          <TextInput
            variant="auth"
            label="비밀번호"
            placeholder="8자 이상"
            required
            type="password"
            {...passwordField}
            error={Boolean(errors.password && allValues.password && allValues.password.trim() !== '')}
            errorText={errors.password?.message}
          />
          <TextInput
            variant="auth"
            label="비밀번호 확인"
            placeholder="다시 입력"
            required
            type="password"
            {...passwordCheckField}
            error={Boolean(errors.passwordCheck && allValues.passwordCheck && allValues.passwordCheck.trim() !== '')}
            errorText={errors.passwordCheck?.message}
          />
        </div>
      )}
      <div className={cx('fieldGroup')}>
        <label className={cx('selectField')}>
          <span className={cx('selectLabel')}>
            성별 <span className={cx('requiredMark')}>*</span>
          </span>
          <span className={cx('selectBox')}>
            <select {...genderField}>
              <option value="" disabled>
                선택
              </option>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
            </select>
          </span>
        </label>
        {/* select가 셋이라 label 하나로는 첫 칸에만 이름이 붙는다 - 묶음(group)으로 이름을 준다 */}
        <div className={cx('birthDateField')} role="group" aria-labelledby="signup-birth-date-label">
          <span className={cx('selectLabel')} id="signup-birth-date-label">
            생년월일 <span className={cx('requiredMark')}>*</span>
          </span>
          <BirthDateSelects className={cx('birthDateSelects')} value={birthDateValue} onChange={onBirthDateChange} />
          {errors.birthDate?.message && allValues.birthDate && allValues.birthDate.trim() !== '' && (
            <span className={cx('birthDateError')}>{errors.birthDate.message}</span>
          )}
        </div>
      </div>
      {/* 우편번호는 주소 검색 결과로만 채워져 따로 보이지 않고 함께 보낸다 */}
      <input type="hidden" {...postcodeField} />
      <div className={cx('addressSearchRow')}>
        <TextInput
          variant="auth"
          label="주소"
          placeholder="주소 검색을 눌러 주세요"
          required
          readOnly
          {...addressField}
          onClick={onAddressSearch}
          error={Boolean(errors.address && allValues.address && allValues.address.trim() !== '')}
          errorText={errors.address?.message}
        />
        <button className={cx('addressSearchButton')} type="button" onClick={onAddressSearch}>
          주소 검색
        </button>
      </div>
      <TextInput
        variant="auth"
        label="상세주소"
        placeholder="동·호수 등"
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
