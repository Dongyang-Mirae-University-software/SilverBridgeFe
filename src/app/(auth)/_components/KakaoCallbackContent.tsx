'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

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

  const { mutate } = useMutation({
    mutationKey: ['kakaoSignin'],
    mutationFn: signinKakao,
    onSuccess: response => {
      const data = getKakaoSigninData(response);
      if (data.isNewUser ?? data.newUser) {
        const params = new URLSearchParams({
          kakaoId: data.kakaoId || '',
          email: data.email || '',
          name: data.name || '',
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
      console.error('카카오 로그인 실패:', error);
      router.push('/login');
    },
  });

  useEffect(() => {
    if (code) {
      mutate({ code, redirectUri: getKakaoRedirectUri() });
    } else {
      router.push('/login');
    }
  }, [code, mutate, router]);

  return <div>카카오 로그인 처리 중...</div>;
}

export function KakaoCallbackContent() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <KakaoCallbackInner />
    </Suspense>
  );
}
