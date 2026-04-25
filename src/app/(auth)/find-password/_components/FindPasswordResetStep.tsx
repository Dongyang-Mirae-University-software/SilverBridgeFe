'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
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

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isValid) {
      onSubmit(newPassword);
    }
  };

  return (
    <form className={cx('form')} onSubmit={handleSubmit}>
      <TextInput
        label="새 비밀번호"
        name="newPassword"
        type="password"
        placeholder="새 비밀번호를 입력하세요"
        value={newPassword}
        onChange={event => setNewPassword(event.target.value)}
      />
      <TextInput
        label="비밀번호 확인"
        name="confirmPassword"
        type="password"
        placeholder="비밀번호를 다시 입력하세요"
        value={confirmPassword}
        onChange={event => setConfirmPassword(event.target.value)}
      />
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
        비밀번호 변경
      </button>
    </form>
  );
}