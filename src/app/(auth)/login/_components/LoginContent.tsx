'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import { login } from '@/service/api/auth';
import styles from './LoginContent.module.css';

const cx = classNames.bind(styles);

export default function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isValid = email.trim().length > 0 && password.trim().length > 0;

  const { mutate, isPending } = useMutation({
    mutationKey: ['login'],
    mutationFn: login,
    onMutate: () => {
      setErrorMessage('');
    },
    onSuccess: () => {
      router.push('/');
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || '로그인에 실패했습니다.');
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isPending) return;

    mutate({
      email: email.trim(),
      password: password.trim(),
    });
  };

  return (
    <section className={cx('container')}>
      <div className={cx('panel')}>
        <div className={cx('header')}>
          <p className={cx('eyebrow')}>Silver Bridge</p>
          <h1 className={cx('title')}>로그인</h1>
          <p className={cx('description')}>이메일과 비밀번호를 입력해 서비스를 이용하세요.</p>
        </div>

        <form className={cx('form')} onSubmit={handleSubmit}>
          <TextInput
            autoComplete="email"
            error={Boolean(errorMessage)}
            errorText={errorMessage}
            label="이메일"
            name="email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
          <TextInput
            autoComplete="current-password"
            label="비밀번호"
            name="password"
            placeholder="비밀번호를 입력하세요"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}

          <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
            {isPending ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className={cx('footer')}>
          <span className={cx('footerText')}>아직 계정이 없나요?</span>
          <button className={cx('linkButton')} type="button" onClick={() => router.push('/signup')}>
            회원가입
          </button>
        </div>
      </div>
    </section>
  );
}
