import { FormEvent } from 'react';

import classNames from 'classnames/bind';
import styles from './ProfileSecurityPanel.module.css';

const cx = classNames.bind(styles);

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

interface Props {
  deleteConfirmation: string;
  deletePassword: string;
  isDeletePending: boolean;
  isKakaoUser: boolean;
  isPasswordPending: boolean;
  onDeleteSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPasswordChange: (form: PasswordForm) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  passwordForm: PasswordForm;
  setDeleteConfirmation: (value: string) => void;
  setDeletePassword: (value: string) => void;
}

export function ProfileSecurityPanel({
  deleteConfirmation,
  deletePassword,
  isDeletePending,
  isKakaoUser,
  isPasswordPending,
  onDeleteSubmit,
  onPasswordChange,
  onPasswordSubmit,
  passwordForm,
  setDeleteConfirmation,
  setDeletePassword,
}: Props) {
  return (
    <section className={cx('profileManageCard')}>
      <div className={cx('profileManageHeader')}>
        <h3>보안</h3>
        <p>비밀번호 변경과 회원 탈퇴를 별도 영역으로 분리했습니다.</p>
      </div>

      <form className={cx('profileForm')} onSubmit={onPasswordSubmit}>
        <div className={cx('profileFormGrid')}>
          <PasswordInput
            disabled={isKakaoUser}
            label="현재 비밀번호"
            value={passwordForm.currentPassword}
            onChange={value => onPasswordChange({ ...passwordForm, currentPassword: value })}
          />
          <PasswordInput
            disabled={isKakaoUser}
            label="새 비밀번호"
            value={passwordForm.newPassword}
            onChange={value => onPasswordChange({ ...passwordForm, newPassword: value })}
          />
          <PasswordInput
            disabled={isKakaoUser}
            label="새 비밀번호 확인"
            value={passwordForm.newPasswordConfirm}
            onChange={value => onPasswordChange({ ...passwordForm, newPasswordConfirm: value })}
          />
        </div>
        <div className={cx('profileModalActions')}>
          <button className={cx('profilePrimaryButton')} type="submit" disabled={isKakaoUser || isPasswordPending}>
            {isPasswordPending ? '변경 중' : '비밀번호 변경'}
          </button>
        </div>
      </form>

      <form className={cx('profileDeleteRow')} onSubmit={onDeleteSubmit}>
        <input
          type={isKakaoUser ? 'text' : 'password'}
          placeholder={isKakaoUser ? '탈퇴' : '현재 비밀번호'}
          value={isKakaoUser ? deleteConfirmation : deletePassword}
          onChange={event => (isKakaoUser ? setDeleteConfirmation(event.target.value) : setDeletePassword(event.target.value))}
        />
        <button className={cx('profileDangerButton')} type="submit" disabled={isDeletePending}>
          {isDeletePending ? '처리 중' : '회원 탈퇴'}
        </button>
      </form>
    </section>
  );
}

function PasswordInput({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={cx('profileField')}>
      <span>{label}</span>
      <input type="password" disabled={disabled} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
