'use client';

import { useEffect, useRef, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { CommonModal } from '@/components/CommonModal';
import { completeSigninSession } from '@/lib/auth/completeSignin';
import { getKakaoRedirectUri } from '@/lib/auth/kakao';
import { getRoleHomePath } from '@/utils/auth/routes';
import { signinKakao } from '@/service/api/auth/auth';
import { IKakaoSigninRes } from '@/service/interface/auth/auth';
import { KAKAO_STATE_COOKIE, isKakaoStateTrusted, parseKakaoState } from '@/lib/auth/kakaoState';
import { saveKakaoSignupHandoff } from '@/lib/auth/kakaoSignupHandoff';
import styles from './KakaoCallbackContent.module.css';

const cx = classNames.bind(styles);

type KakaoSigninData = IKakaoSigninRes['data'];

function getKakaoSigninData(response: unknown): KakaoSigninData {
  const data = (response as { data?: unknown }).data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;

  return (nestedData ?? data ?? response) as KakaoSigninData;
}

function KakaoCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const returnTo = parseKakaoState(state)?.returnTo ?? null;
  const [errorMessage, setErrorMessage] = useState('');
  // 인가 코드는 한 번만 쓸 수 있고 state 쿠키도 확인하면서 지운다 - 다시 그려져도 한 번만 처리한다
  const handledRef = useRef(false);

  const { mutate } = useMutation({
    mutationKey: ['kakaoSignin'],
    mutationFn: signinKakao,
    onSuccess: response => {
      const data = getKakaoSigninData(response);
      if (data.isNewUser ?? data.newUser) {
        if (!data.kakaoId || !data.email || !data.pendingToken) {
          setErrorMessage('카카오 가입 정보를 받지 못했습니다. 다시 시도해주세요.');
          return;
        }
        // 카카오 ID·이메일·일회용 값은 주소에 싣지 않는다(방문 기록에 남는다) - 이 탭에서만 가입 화면으로 넘긴다
        saveKakaoSignupHandoff({
          kakaoId: data.kakaoId,
          email: data.email,
          profileImageUrl: data.profileImageUrl || undefined,
          pendingToken: data.pendingToken,
        });
        const params = new URLSearchParams({ kakao: '1' });
        if (returnTo) params.set('returnTo', returnTo);
        router.push(`/signup?${params.toString()}`);
        return;
      }

      if (data.accessToken) {
        completeSigninSession({
          accessToken: data.accessToken,
          role: data.role,
        });
      }
      if (data.role) {
        router.push(returnTo ?? getRoleHomePath(data.role));
        return;
      }

      router.push('/login');
    },
    onError: error => {
      setErrorMessage((error as Error).message || '카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    },
  });

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    if (!code) {
      router.push('/login');
      return;
    }

    // 이 브라우저가 시작한 로그인인지 확인한다. 아니면 인가 코드를 서버로 보내지 않는다
    const trusted = isKakaoStateTrusted(state, takeStateCookie());
    if (!trusted) {
      setErrorMessage('카카오 로그인을 처음부터 다시 시도해주세요.');
      return;
    }

    mutate({ code, redirectUri: getKakaoRedirectUri() });
  }, [code, mutate, router, state]);

  const handleErrorClose = () => {
    setErrorMessage('');
    router.replace('/login');
  };

  return (
    <>
      <LoadingScreen label="카카오 로그인 처리 중..." />
      {errorMessage && (
        <CommonModal type="error" title="카카오 로그인 실패" message={errorMessage} onClose={handleErrorClose} />
      )}
    </>
  );
}

// state 쿠키를 읽고 지운다(한 번 쓰는 값)
function takeStateCookie() {
  const item = document.cookie.split('; ').find(cookie => cookie.startsWith(`${KAKAO_STATE_COOKIE}=`));
  document.cookie = `${KAKAO_STATE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  return item ? decodeURIComponent(item.slice(KAKAO_STATE_COOKIE.length + 1)) : null;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className={cx('loadingScreen')}>
      <span className={cx('spinner')} aria-hidden="true" />
      <p className={cx('loadingText')}>{label}</p>
    </div>
  );
}

export function KakaoCallbackContent() {
  return (
    <Suspense fallback={<LoadingScreen label="로딩 중..." />}>
      <KakaoCallbackInner />
    </Suspense>
  );
}
