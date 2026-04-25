'use client';

import { FormEvent } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import styles from './FindPasswordContent.module.css';

const cx = classNames(bind);

interface Props {
  email: string;
  errorMessage: string;
  isPending: boolean;
  onChange: (email: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResend?: () => void;
}

export default function FindPasswordEmailStep({ email, errorMessage, isPending, onChange, onSubmit, onResend }: Props) {
  const isValid = email.trim().length > 0;

  return (
    <form className={cx('form')} onSubmit={onSubmit}>
      <TextInput
        label="이메일"
        name="email"
        type="email"
        placeholder="이메일을 입력하세요"
        value={email}
        onChange={event => onChange(event.target.value)}
      />
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
        이메일 발송
      </button>
      {onResend && (
        <button className={cx('secondaryButton')} type="button" onClick={onResend}>
          이메일 재발송
        </button>
      )}
    </form>
  );
}