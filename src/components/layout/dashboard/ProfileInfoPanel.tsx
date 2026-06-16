import { FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { UseMutationResult } from '@tanstack/react-query';

import { signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import { GenderType } from '@/service/interface/auth';
import { IUserUpdateReq } from '@/service/interface/user';
import { BirthDateSelects } from '@/components/BirthDateSelects';
import { formatPhoneNumber, getPhoneDigits } from '@/lib/format/phone';
import classNames from 'classnames/bind';
import styles from './ProfileInfoPanel.module.css';

const cx = classNames.bind(styles);

interface Props {
  form: IUserUpdateReq;
  isEditing: boolean;
  isPhoneChanged: boolean;
  isProfilePending: boolean;
  onAddressSearch: () => void;
  onCancelEdit: () => void;
  onChange: (field: keyof IUserUpdateReq, value: string) => void;
  onEditStart: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  phoneCode: string;
  phoneNonce: string | null;
  setPhoneCode: (value: string) => void;
  smsSendMutation: UseMutationResult<unknown, Error, Parameters<typeof signupSmsSend>[0]>;
  smsVerifyMutation: UseMutationResult<unknown, Error, Parameters<typeof signupSmsVerify>[0]>;
}

export function ProfileInfoPanel({
  form,
  isEditing,
  isPhoneChanged,
  isProfilePending,
  onAddressSearch,
  onCancelEdit,
  onChange,
  onEditStart,
  onSubmit,
  phoneCode,
  phoneNonce,
  setPhoneCode,
  smsSendMutation,
  smsVerifyMutation,
}: Props) {
  return (
    <section className={cx('profileManageCard')}>
      <div className={cx('profileManageHeader')}>
        <div>
          <h3>기본 정보</h3>
          <p>정보 수정 버튼을 누르면 같은 자리가 입력칸으로 바뀝니다.</p>
        </div>
        <button className={cx('profileHeaderAction')} type="button" onClick={isEditing ? onCancelEdit : onEditStart}>
          {isEditing ? '수정 취소' : '정보 수정'}
        </button>
      </div>

      <form className={cx('profileForm')} onSubmit={onSubmit}>
        <ProfileRow label="이름" editing={isEditing}>
          {isEditing ? (
            <ProfileTextInput maxLength={20} value={form.name ?? ''} onValueChange={value => onChange('name', value)} />
          ) : (
            <span>{getFieldValue(form.name)}</span>
          )}
        </ProfileRow>

        <ProfileRow label="전화번호" editing={isEditing}>
          {isEditing ? (
            <ProfileTextInput
              inputMode="numeric"
              value={formatPhoneNumber(form.phone ?? '')}
              onValueChange={value => onChange('phone', getPhoneDigits(value))}
            />
          ) : (
            <span>{formatPhoneNumber(form.phone ?? '') || '정보 없음'}</span>
          )}
        </ProfileRow>

        <ProfileRow label="성별" editing={isEditing}>
          {isEditing ? (
            <select value={form.gender ?? ''} onChange={event => onChange('gender', event.target.value as GenderType | '')}>
              <option value="" disabled>
                선택
              </option>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
            </select>
          ) : (
            <span>{getGenderLabel(form.gender)}</span>
          )}
        </ProfileRow>

        <ProfileRow label="생년월일" editing={isEditing}>
          {isEditing ? (
            <BirthDateSelects className={cx('profileBirthDateSelects')} value={form.birthDate ?? ''} onChange={value => onChange('birthDate', value)} />
          ) : (
            <span>{getFieldValue(form.birthDate)}</span>
          )}
        </ProfileRow>

        <ProfileRow
          label="주소"
          editing={isEditing}
          action={
            isEditing ? (
              <button className={cx('profileInlineAction')} type="button" onClick={onAddressSearch}>
                주소 검색
              </button>
            ) : null
          }
        >
          {isEditing ? (
            <>
              <ProfileTextInput readOnly value={form.postcode ?? ''} onValueChange={value => onChange('postcode', value.replace(/\D/g, ''))} />
              <ProfileTextInput readOnly value={form.address ?? ''} onValueChange={value => onChange('address', value)} />
              <ProfileTextInput
                placeholder="상세 주소"
                value={form.addressDetail ?? ''}
                onValueChange={value => onChange('addressDetail', value)}
              />
            </>
          ) : (
            <span>{[form.address, form.addressDetail].filter(Boolean).join(' ') || '정보 없음'}</span>
          )}
        </ProfileRow>

        {isEditing && isPhoneChanged && (
          <div className={cx('profilePhoneVerify')}>
            <div className={cx('profileRowHeader')}>
              <span className={cx('profileRowLabel')}>휴대폰 인증</span>
              <span className={cx('profilePhoneState')}>{phoneNonce ? '인증 완료' : '인증 필요'}</span>
            </div>
            <p className={cx('profilePhoneVerifyDesc')}>번호를 바꾼 경우 SMS 인증을 먼저 완료해야 저장할 수 있습니다.</p>
            <div className={cx('profilePhoneVerifyActions')}>
              <button
                className={cx('profileInlineAction')}
                type="button"
                disabled={smsSendMutation.isPending}
                onClick={() => smsSendMutation.mutate({ phone: (form.phone ?? '').trim() })}
              >
                {smsSendMutation.isPending ? '발송 중' : '인증번호 발송'}
              </button>
              <input inputMode="numeric" placeholder="인증번호" value={phoneCode} onChange={event => setPhoneCode(event.target.value)} />
              <button
                className={cx('profileInlineAction')}
                type="button"
                disabled={smsVerifyMutation.isPending || !phoneCode.trim()}
                onClick={() => smsVerifyMutation.mutate({ phone: (form.phone ?? '').trim(), code: phoneCode.trim() })}
              >
                {smsVerifyMutation.isPending ? '확인 중' : phoneNonce ? '인증 완료' : '인증 확인'}
              </button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className={cx('profileModalActions')}>
            <button className={cx('profilePrimaryButton')} type="submit" disabled={isProfilePending}>
              {isProfilePending ? '저장 중' : '프로필 저장'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function ProfileRow({
  children,
  action,
  editing,
  label,
}: {
  children: ReactNode;
  action?: ReactNode;
  editing: boolean;
  label: string;
}) {
  return (
    <div className={cx('profileRow', { profileRowEditing: editing })}>
      <div className={cx('profileRowHeader')}>
        <span className={cx('profileRowLabel')}>{label}</span>
        {action}
      </div>
      <div className={cx('profileFieldBody')}>{children}</div>
    </div>
  );
}

function ProfileTextInput({
  onValueChange,
  value,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & { onValueChange: (value: string) => void; value: string }) {
  return <input {...inputProps} value={value} onChange={event => onValueChange(event.target.value)} />;
}

function getFieldValue(value?: string | null) {
  return value?.trim() ? value : '정보 없음';
}

function getGenderLabel(gender: GenderType | '' | null | undefined) {
  if (gender === 'FEMALE') return '여성';
  if (gender === 'MALE') return '남성';
  return '정보 없음';
}
