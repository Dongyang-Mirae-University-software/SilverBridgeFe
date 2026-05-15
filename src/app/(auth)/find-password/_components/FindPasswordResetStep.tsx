'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import { PASSWORD_PATTRERN } from '@/app/constant/pattern';
import styles from './FindPasswordContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  errorMessage: string;
  isPending: boolean;
  onSubmit: (newPassword: string) => void;
}

export default function FindPasswordResetStep({ errorMessage, isPending, onSubmit }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isPasswordValid = PASSWORD_PATTRERN.test(newPassword);
  const isConfirmValid = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isValid = isPasswordValid && isConfirmValid;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isValid) {
      onSubmit(newPassword);
    }
  };

  return (
    <form className={cx('form')} onSubmit={handleSubmit}>
      <div className={cx('resetIntro')}>
        <h2 className={cx('resetTitle')}>새 비밀번호 생성</h2>
        <p className={cx('description')}>새로운 비밀번호를 설정해 주세요.</p>
      </div>
      <div className={cx('passwordFields')}>
        <TextInput
          error={newPassword.length > 0 && !isPasswordValid}
          errorText={newPassword.length > 0 && !isPasswordValid ? '8자 이상, 숫자와 특수문자를 포함해야 합니다.' : undefined}
          label="새 비밀번호"
          name="newPassword"
          type="password"
          placeholder="8자 이상"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
        />
        <TextInput
          error={confirmPassword.length > 0 && !isConfirmValid}
          errorText={confirmPassword.length > 0 && !isConfirmValid ? '비밀번호가 일치하지 않습니다.' : undefined}
          label="비밀번호 확인"
          name="confirmPassword"
          type="password"
          placeholder="다시 입력"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
        />
      </div>
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
        {isPending ? '생성 중...' : '새 비밀번호 생성'}
      </button>
    </form>
  );
}
