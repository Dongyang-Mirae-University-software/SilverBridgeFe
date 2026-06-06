'use client';

import { FormEvent } from 'react';

import TextInput from '@/components/TextInput';
import styles from './FindPasswordEmailStep.module.css';
const cx = classNames.bind(styles);

interface Props {
  email: string;
  errorMessage: string;
  isPending: boolean;
  onChange: (email: string) => void;
  onFindEmail: () => void;
  onKakaoLogin: () => void;
  onSignup: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResend?: () => void;
}

export default function FindPasswordEmailStep({
  email,
  errorMessage,
  isPending,
  onChange,
  onFindEmail,
  onKakaoLogin,
  onSignup,
  onSubmit,
  onResend,
}: Props) {
  const isValid = email.trim().length > 0;
  const isKakaoAccount = errorMessage.includes('카카오로 가입한 계정');
  const isUnknownEmail = errorMessage.includes('해당 이메일로 가입된 계정이 없습니다.');

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
      {isKakaoAccount && (
        <button className={cx('secondaryButton')} type="button" onClick={onKakaoLogin}>
          카카오 로그인으로 이동
        </button>
      )}
      {isUnknownEmail && (
        <div className={cx('inlineActions')}>
          <button className={cx('secondaryButton')} type="button" onClick={onSignup}>
            회원가입
          </button>
          <button className={cx('secondaryButton')} type="button" onClick={onFindEmail}>
            아이디 찾기
          </button>
        </div>
      )}
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
