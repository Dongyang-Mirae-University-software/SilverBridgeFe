'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getMyProfile } from '@/service/api/user';
import { getRoleHomePath } from '@/lib/auth/routes';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { clearAuthTokens, getAccessToken, getAuthRole, setAuthRole } from '@/lib/auth/tokenStore';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const redirectByAuthState = async () => {
      const accessToken = getAccessToken();

      if (!accessToken) {
        router.replace('/login');
        return;
      }

      const storedRole = getAuthRole();

      if (storedRole) {
        router.replace(getRoleHomePath(storedRole));
        return;
      }

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

      router.replace('/login');
    };

    void redirectByAuthState();
  }, [router]);

  return null;
}
