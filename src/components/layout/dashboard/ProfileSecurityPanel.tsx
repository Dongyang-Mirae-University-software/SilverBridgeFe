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
  isKakaoUser: boolean;
  isPasswordPending: boolean;
  onPasswordChange: (form: PasswordForm) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  passwordForm: PasswordForm;
}

export function ProfileSecurityPanel({
  isKakaoUser,
  isPasswordPending,
  onPasswordChange,
  onPasswordSubmit,
  passwordForm,
}: Props) {
  return (
    <section className={cx('profileManageCard')}>
      <div className={cx('profileManageHeader')}>
        <h3>보안</h3>
        <p>비밀번호만 변경할 수 있습니다.</p>
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
