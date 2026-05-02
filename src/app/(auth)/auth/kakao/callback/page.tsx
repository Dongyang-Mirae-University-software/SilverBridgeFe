'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { signinKakao } from '@/service/api/auth';

function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const { mutate } = useMutation({
    mutationKey: ['kakaoSignin'],
    mutationFn: signinKakao,
    onSuccess: (response: any) => {
      const data = response.data;
      if (data.newUser) {
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
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
      }
      router.push('/');
    },
    onError: (error) => {
      console.error('카카오 로그인 실패:', error);
      router.push('/login');
    },
  });

  useEffect(() => {
    if (code) {
      mutate({ code });
    } else {
      router.push('/login');
    }
  }, [code, mutate, router]);

  return <div>카카오 로그인 처리 중...</div>;
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <KakaoCallbackContent />
    </Suspense>
  );
}