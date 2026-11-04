import { FieldErrors, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form';
import classNames from 'classnames/bind';

import styles from './SignupInfoStep.module.css';
import SignupRoleSelector from './SignupRoleSelector';
import TextInput from '@/components/TextInput';
import { SignupFormValues } from '@/hooks/useSignupForm';
import { BirthDateSelects } from '@/components/BirthDateSelects';

const cx = classNames.bind(styles);


interface SignupProfileStepProps {
  allValues: SignupFormValues;
  errors: FieldErrors<SignupFormValues>;
  isValid: boolean;
  // 카카오 가입은 '계정' 단계가 없어 가입 유형을 여기서 고른다
  showRoleSelector?: boolean;
  register: UseFormRegister<SignupFormValues>;
  nameField: UseFormRegisterReturn;
  genderField: UseFormRegisterReturn;
  addressField: UseFormRegisterReturn;
  addressDetailField: UseFormRegisterReturn;
  birthDateValue: string;
  onBirthDateChange: (value: string) => void;
  postcodeField: UseFormRegisterReturn;
  onAddressSearch: () => void;
  onNext: () => void;
  onPrev?: () => void;
}

// 2단계(내 정보): 이름 · 성별·생년월일 · 주소 · 상세주소
export default function SignupProfileStep({
  allValues,
  errors,
  isValid,
  showRoleSelector = false,
  register,
  nameField,
  genderField,
  addressField,
  addressDetailField,
  birthDateValue,
  onBirthDateChange,
  postcodeField,
  onAddressSearch,
  onNext,
  onPrev,
}: SignupProfileStepProps) {
  return (
    <>
      {showRoleSelector && <SignupRoleSelector role={allValues.role} register={register} />}
      <TextInput
        variant="auth"
        label="이름"
        placeholder="홍길동"
        required
        autoComplete="name"
        {...nameField}
        error={Boolean(errors.name && allValues.name && allValues.name.trim() !== '')}
        errorText={errors.name?.message}
      />
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
      <div className={cx('stepActions')}>
        {onPrev && (
          <button className={cx('prevButton')} type="button" onClick={onPrev}>
            이전
          </button>
        )}
        <button className={cx('button')} disabled={!isValid} type="button" onClick={onNext}>
          다음
        </button>
      </div>
    </>
  );
}
