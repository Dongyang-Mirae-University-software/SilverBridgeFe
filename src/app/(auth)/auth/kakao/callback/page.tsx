'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { signinKakao } from '@/service/api/auth';

export default function KakaoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const { mutate } = useMutation({
    mutationKey: ['kakaoSignin'],
    mutationFn: signinKakao,
    onSuccess: (data) => {
      if (data.newUser) {
        // 신규 회원: 회원가입 페이지로 이동, 데이터 전달
        const params = new URLSearchParams({
          kakaoId: data.kakaoId || '',
          email: data.email || '',
          name: data.name || '',
          profileImageUrl: data.profileImageUrl || '',
        });
        router.push(`/signup?${params.toString()}`);
      } else {
        // 기존 회원: 로그인 처리, 홈으로
        // 토큰 저장 등 필요
        router.push('/');
      }
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