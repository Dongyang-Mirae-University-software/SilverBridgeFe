'use client';

import { ReactNode, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { myProfileQueryOptions } from '@/service/query/user';
import { getRoleHomePath } from '@/utils/auth/routes';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { AuthRole, clearAuthTokens, getAccessToken, setAuthRole } from '@/lib/auth/tokenStore';
import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import { reportNonApiError } from '@/lib/api/reportError';

interface Props {
  allowedRole: AuthRole;
  children: ReactNode;
}

export default function RoleRouteGuard({ allowedRole, children }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken();
  const { data: profileResponse, isError, isLoading } = useQuery({
    ...myProfileQueryOptions,
    enabled: Boolean(accessToken),
  });
  const profile = getUserProfileData(profileResponse);
  const isAllowed = Boolean(accessToken && profile?.role === allowedRole);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
      return;
    }

    if (isError) {
      clearAuthTokens();
      router.replace('/login');
      return;
    }

    if (profile?.role) {
      setAuthRole(profile.role);
    }

    if (profile?.role && profile.role !== allowedRole) {
      router.replace(getRoleHomePath(profile.role));
    }
  }, [accessToken, allowedRole, isError, profile?.role, router]);

  useEffect(() => {
    if (!accessToken) return;

    void queryClient.prefetchQuery(myProfileQueryOptions);
  }, [accessToken, queryClient]);

  useEffect(() => {
    if (!isAllowed) return;

    void registerFcmTokenForCurrentDevice().catch(error => {
      reportNonApiError('FCM 토큰 등록 실패:', error);
    });
  }, [isAllowed]);

  if (isLoading || !isAllowed) return null;

  return children;
}
