'use client';

import { ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { getMyProfile } from '@/service/api/user';
import { getRoleHomePath } from '@/lib/auth/routes';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { AuthRole, clearAuthTokens, getAccessToken, setAuthRole } from '@/lib/auth/tokenStore';

interface Props {
  allowedRole: AuthRole;
  children: ReactNode;
}

export default function RoleRouteGuard({ allowedRole, children }: Props) {
  const router = useRouter();
  const accessToken = getAccessToken();
  const { data: profileResponse, isError, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: getMyProfile,
    enabled: Boolean(accessToken),
    retry: false,
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

  if (isLoading || !isAllowed) return null;

  return children;
}
