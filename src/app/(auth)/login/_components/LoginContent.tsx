'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import classNames from 'classnames/bind';

import TextInput from '@/app/_components/common/TextInput';
import { signin } from '@/service/api/auth';
import { ISigninResponse } from '@/service/interface/auth';
import { setAuthTokens } from '@/lib/auth/tokenStore';
import styles from './LoginContent.module.css';

const cx = classNames.bind(styles);

function getSigninData(response: unknown) {
  const data = (response as { data?: unknown }).data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;

  return (nestedData ?? data ?? response) as ISigninResponse;
}

export default function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const isValid = email.trim().length > 0 && password.trim().length > 0;

  const { mutate, isPending } = useMutation({
    mutationKey: ['login'],
    mutationFn: signin,
    onMutate: () => {
      setErrorMessage('');
    },
    onSuccess: response => {
      const data = getSigninData(response);

      if (data.accessToken && data.refreshToken) {
        setAuthTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: data.role,
        });
      }

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

  const handleKakaoLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/kakao/callback`;
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
    window.location.href = kakaoAuthUrl;
  };

  return (
    <>
      <div className={cx('header')}>
        <h2 className={cx('title')}>로그인</h2>
        <p className={cx('description')}>다시 오신 것을 환영해요</p>
      </div>

      <form className={cx('form')} onSubmit={handleSubmit}>
        <div className={cx('fields')}>
          <TextInput
            autoComplete="email"
            error={Boolean(errorMessage)}
            errorText={errorMessage}
            label="이메일"
            name="email"
            required={false}
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
          <TextInput
            autoComplete="current-password"
            label="비밀번호"
            name="password"
            required={false}
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>

        <div className={cx('secondaryActions')}>
          <label className={cx('remember')}>
            <input
              checked={remember}
              type="checkbox"
              onChange={event => setRemember(event.target.checked)}
            />
            로그인 유지
          </label>
          <div className={cx('findLinks')}>
            <button className={cx('textButton')} type="button" onClick={() => router.push('/find-email')}>
              아이디 찾기
            </button>
            <span className={cx('separator')} />
            <button className={cx('textButton', 'accentTextButton')} type="button" onClick={() => router.push('/find-password')}>
              비밀번호 찾기
            </button>
          </div>
        </div>

        {errorMessage && <p className={cx('errorMessage')}>{errorMessage}</p>}

        <button className={cx('submitButton')} disabled={!isValid || isPending} type="submit">
          {isPending ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className={cx('divider')}>
        <span />
        간편 로그인
        <span />
      </div>

      <button className={cx('kakaoButton')} type="button" onClick={handleKakaoLogin}>
        <svg width="20" height="20" viewBox="0 0 36 36" aria-hidden="true">
          <path
            fill="#3C1E1E"
            d="M18 6C10.82 6 5 10.6 5 16.27c0 3.7 2.5 6.93 6.18 8.7-.27.94-.97 3.4-1.11 3.93-.18.66.24.65.51.47.21-.14 3.36-2.28 4.7-3.2.9.13 1.83.2 2.72.2 7.18 0 13-4.6 13-10.27S25.18 6 18 6z"
          />
        </svg>
        카카오로 로그인
      </button>

      <div className={cx('footer')}>
        아직 계정이 없으신가요?{' '}
        <button className={cx('signupLink')} type="button" onClick={() => router.push('/signup')}>
          회원가입
        </button>
      </div>
    </>
  );
}
