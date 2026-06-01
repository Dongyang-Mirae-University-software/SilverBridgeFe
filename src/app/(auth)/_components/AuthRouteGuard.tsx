'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getMyProfile } from '@/service/api/user';
import { getRoleHomePath } from '@/lib/auth/routes';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthRole, setAuthTokens } from '@/lib/auth/tokenStore';

async function refreshStoredToken(refreshToken: string) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return false;

  const responseBody = await response.json().catch(() => null);
  const data = responseBody?.data;
  const isSuccess = responseBody?.success === true || responseBody?.code === 200;

  if (!isSuccess || !data?.accessToken || !data?.refreshToken) return false;

  setAuthTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  return true;
}

export default function AuthRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();

      if (accessToken) {
        try {
          const profile = getUserProfileData(await getMyProfile());

          if (profile?.role) {
            setAuthRole(profile.role);
            router.replace(getRoleHomePath(profile.role));
            return;
          }
        } catch {
          clearAuthTokens();
        }
      }

      if (!refreshToken) {
        if (isMounted) setIsChecking(false);
        return;
      }

      try {
        const hasSession = await refreshStoredToken(refreshToken);

        if (hasSession) {
          try {
            const profile = getUserProfileData(await getMyProfile());

            if (profile?.role) {
              setAuthRole(profile.role);
              router.replace(getRoleHomePath(profile.role));
              return;
            }
          } catch {
            clearAuthTokens();
          }
        }

        if (isMounted) setIsChecking(false);
      } catch {
        clearAuthTokens();
        if (isMounted) setIsChecking(false);
      }
    };

    void redirectIfAuthenticated();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isChecking) return null;

  return children;
}
