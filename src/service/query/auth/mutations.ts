'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logout } from '@/service/api/auth/auth';
import { clearAuthTokens, getAccessToken } from '@/lib/auth/tokenStore';
import { unregisterFcmTokenForCurrentDevice } from '@/lib/fcm';
import { reportNonApiError } from '@/lib/api/reportError';

// 푸시 토큰을 지운 뒤 서버 세션을 끝낸다. 화면은 이미 로그인으로 넘어가 있어 실패해도 사용자를 붙잡지 않는다
async function endServerSession(accessToken: string) {
  await unregisterFcmTokenForCurrentDevice(accessToken).catch(error => reportNonApiError('FCM 토큰 삭제 실패:', error));
  await logout(accessToken).catch(error => reportNonApiError('로그아웃 요청 실패:', error));
}

export function useLogoutMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['logout'],
    // 누르자마자 이 기기의 세션을 지우고 로그인 화면으로 보낸다. 서버 정리는 기다리지 않는다
    // (푸시 토큰 삭제가 서비스 워커를 기다리며 멈추거나 서버가 느리면 로그아웃이 안 되는 것처럼 보였다)
    mutationFn: async () => {
      const accessToken = getAccessToken();
      void queryClient.cancelQueries();
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
      if (accessToken) void endServerSession(accessToken);
    },
  });
}
