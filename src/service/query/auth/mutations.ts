'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logout } from '@/service/api/auth/auth';
import { clearAuthTokens } from '@/lib/auth/tokenStore';
import { unregisterFcmTokenForCurrentDevice } from '@/lib/fcm';
import { reportNonApiError } from '@/lib/api/reportError';

export function useLogoutMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['logout'],
    mutationFn: async () => {
      await unregisterFcmTokenForCurrentDevice().catch(error => reportNonApiError('FCM 토큰 삭제 실패:', error));
      return logout();
    },
    onSettled: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
  });
}
