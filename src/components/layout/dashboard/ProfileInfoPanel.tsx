import { FormEvent, InputHTMLAttributes } from 'react';
import { UseMutationResult } from '@tanstack/react-query';

import { signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import { GenderType } from '@/service/interface/auth';
import { IUserUpdateReq } from '@/service/interface/user';
import { formatPhoneNumber, getPhoneDigits } from '@/lib/format/phone';
import classNames from 'classnames/bind';
import styles from './ProfileInfoPanel.module.css';

const cx = classNames.bind(styles);

interface Props {
  form: IUserUpdateReq;
  isPhoneChanged: boolean;
  isProfilePending: boolean;
  onChange: (field: keyof IUserUpdateReq, value: string) => void;
  onAddressSearch: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  phoneCode: string;
  phoneNonce: string | null;
  setPhoneCode: (value: string) => void;
  smsSendMutation: UseMutationResult<unknown, Error, Parameters<typeof signupSmsSend>[0]>;
  smsVerifyMutation: UseMutationResult<unknown, Error, Parameters<typeof signupSmsVerify>[0]>;
}

export function ProfileInfoPanel({
  form,
  isPhoneChanged,
  isProfilePending,
  onChange,
  onAddressSearch,
  onSubmit,
  phoneCode,
  phoneNonce,
  setPhoneCode,
  smsSendMutation,
  smsVerifyMutation,
}: Props) {
  return (
    <section className={cx('profileManageCard')}>
      <form className={cx('profileForm')} onSubmit={onSubmit}>
        <div className={cx('profileFormGrid')}>
          <ProfileInput label="이름" maxLength={20} value={form.name ?? ''} onValueChange={value => onChange('name', value)} />
          <ProfileInput
            inputMode="numeric"
            label="전화번호"
            value={formatPhoneNumber(form.phone ?? '')}
            onValueChange={value => onChange('phone', getPhoneDigits(value))}
          />
          <label className={cx('profileField')}>
            <span>성별</span>
            <select value={form.gender ?? 'FEMALE'} onChange={event => onChange('gender', event.target.value as GenderType)}>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
            </select>
          </label>
          <ProfileInput label="생년월일" type="date" value={form.birthDate ?? ''} onValueChange={value => onChange('birthDate', value)} />
          <div className={cx('profileAddressSearch')}>
            <ProfileInput
              inputMode="numeric"
              label="우편번호"
              maxLength={5}
              readOnly
              value={form.postcode ?? ''}
              onValueChange={value => onChange('postcode', value.replace(/\D/g, ''))}
            />
            <button className={cx('profileModalGhostButton')} type="button" onClick={onAddressSearch}>
              주소 검색
            </button>
          </div>
          <ProfileInput label="주소" readOnly value={form.address ?? ''} onValueChange={value => onChange('address', value)} />
        </div>

        <ProfileInput label="상세 주소" value={form.addressDetail ?? ''} onValueChange={value => onChange('addressDetail', value)} />

        {isPhoneChanged && (
          <div className={cx('profilePhoneVerify')}>
            <button
              className={cx('profileModalGhostButton')}
              type="button"
              disabled={smsSendMutation.isPending}
              onClick={() => smsSendMutation.mutate({ phone: (form.phone ?? '').trim() })}
            >
              {smsSendMutation.isPending ? '발송 중' : '인증번호 발송'}
            </button>
            <input inputMode="numeric" placeholder="인증번호" value={phoneCode} onChange={event => setPhoneCode(event.target.value)} />
            <button
              className={cx('profileModalGhostButton')}
              type="button"
              disabled={smsVerifyMutation.isPending || !phoneCode.trim()}
              onClick={() => smsVerifyMutation.mutate({ phone: (form.phone ?? '').trim(), code: phoneCode.trim() })}
            >
              {smsVerifyMutation.isPending ? '확인 중' : phoneNonce ? '인증 완료' : '인증 확인'}
            </button>
          </div>
        )}

        <div className={cx('profileModalActions')}>
          <button className={cx('profilePrimaryButton')} type="submit" disabled={isProfilePending}>
            {isProfilePending ? '저장 중' : '프로필 저장'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ProfileInput({
  label,
  onValueChange,
  value,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & { label: string; onValueChange: (value: string) => void; value: string }) {
  return (
    <label className={cx('profileField')}>
      <span>{label}</span>
      <input {...inputProps} value={value} onChange={event => onValueChange(event.target.value)} />
    </label>
  );
}
