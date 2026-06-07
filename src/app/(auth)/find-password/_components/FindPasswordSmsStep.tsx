'use client';

import { FormEvent } from 'react';
import classNames from 'classnames/bind';

import TextInput from '@/components/TextInput';
import { formatPhoneNumber, getPhoneDigits } from '@/lib/format/phone';
import styles from './FindPasswordSmsStep.module.css';

const cx = classNames.bind(styles);

interface Props {
  name: string;
  phone: string;
  errorMessage: string;
  isPending: boolean;
  onChange: (field: 'name' | 'phone', value: string) => void;
  onKakaoLogin: () => void;
  onSignup: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResend?: () => void;
}

export default function FindPasswordSmsStep({
  name,
  phone,
  errorMessage,
  isPending,
  onChange,
  onKakaoLogin,
  onSignup,
  onSubmit,
  onResend,
}: Props) {
  const isValid = name.trim().length > 0 && phone.trim().length > 0;
  const isKakaoAccount = errorMessage.includes('카카오로 가입한 계정');
  const isUnknownUser = errorMessage.includes('사용자를 찾을 수 없습니다.');

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
        value={formatPhoneNumber(phone)}
        onChange={event => onChange('phone', getPhoneDigits(event.target.value))}
      />
      {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}
      {isKakaoAccount && (
        <button className={cx('secondaryButton')} type="button" onClick={onKakaoLogin}>
          카카오 로그인으로 이동
        </button>
      )}
      {isUnknownUser && (
        <button className={cx('secondaryButton')} type="button" onClick={onSignup}>
          회원가입
        </button>
      )}
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
