'use client';

import { FormEvent } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import styles from './FindPasswordContent.module.css';

const cx = classNames(bind);

interface Props {
  name: string;
  phone: string;
  errorMessage: string;
  isPending: boolean;
  onChange: (field: 'name' | 'phone', value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResend?: () => void;
}

export default function FindPasswordSmsStep({ name, phone, errorMessage, isPending, onChange, onSubmit, onResend }: Props) {
  const isValid = name.trim().length > 0 && phone.trim().length > 0;

  return (
    <form className={cx('form')} onSubmit={onSubmit}>
      <TextInput
        label="이름"
        name="name"
        placeholder="이름을 입력하세요"
        value={name}
        onChange={event => onChange('name', event.target.value)}
      />
      <TextInput
        autoComplete="tel"
        label="휴대폰 번호"
        name="phone"
        placeholder="숫자만 입력하세요"
        type="tel"
        value={phone}
        onChange={event => onChange('phone', event.target.value)}
      />
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
        인증번호 발송
      </button>
      {onResend && (
        <button className={cx('secondaryButton')} type="button" onClick={onResend}>
          인증번호 재발송
        </button>
      )}
    </form>
  );
}