'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

import { CommonModal } from '@/components/CommonModal';
import { completeSigninSession } from '@/lib/auth/completeSignin';
import { getKakaoRedirectUri } from '@/lib/auth/kakao';
import { getRoleHomePath } from '@/lib/auth/routes';
import { signinKakao } from '@/service/api/auth';
import { IKakaoSigninRes } from '@/service/interface/auth';

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
  const [errorMessage, setErrorMessage] = useState('');

  const { mutate } = useMutation({
    mutationKey: ['kakaoSignin'],
    mutationFn: signinKakao,
    onSuccess: response => {
      const data = getKakaoSigninData(response);
      if (data.isNewUser ?? data.newUser) {
        const params = new URLSearchParams({
          kakaoId: data.kakaoId || '',
          email: data.email || '',
          profileImageUrl: data.profileImageUrl || '',
        });
        router.push(`/signup?${params.toString()}`);
        return;
      }

      if (data.accessToken && data.refreshToken) {
        completeSigninSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: data.role,
        });
      }
      if (data.role) {
        router.push(getRoleHomePath(data.role));
        return;
      }

      router.push('/login');
    },
    onError: error => {
      setErrorMessage((error as Error).message || '카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    },
  });

  useEffect(() => {
    if (code) {
      mutate({ code, redirectUri: getKakaoRedirectUri() });
    } else {
      router.push('/login');
    }
  }, [code, mutate, router]);

  const handleErrorClose = () => {
    setErrorMessage('');
    router.replace('/login');
  };

  return (
    <>
      <div>카카오 로그인 처리 중...</div>
      {errorMessage && (
        <CommonModal type="error" title="카카오 로그인 실패" message={errorMessage} onClose={handleErrorClose} />
      )}
    </>
  );
}

export function KakaoCallbackContent() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <KakaoCallbackInner />
    </Suspense>
  );
}
