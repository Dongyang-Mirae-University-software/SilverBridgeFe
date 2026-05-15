'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

async function refreshStoredToken(refreshToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const response = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return false;

  const responseBody = await response.json().catch(() => null);
  const data = responseBody?.data;
  const isSuccess = responseBody?.success === true || responseBody?.code === 200;

  if (!isSuccess || !data?.accessToken || !data?.refreshToken) return false;

  localStorage.setItem('access_token', data.accessToken);
  localStorage.setItem('refresh_token', data.refreshToken);

  return true;
}

export default function AuthRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (accessToken) {
        router.replace('/');
        return;
      }

      if (!refreshToken) {
        if (isMounted) setIsChecking(false);
        return;
      }

      try {
        const hasSession = await refreshStoredToken(refreshToken);

        if (hasSession) {
          router.replace('/');
          return;
        }

        if (isMounted) setIsChecking(false);
      } catch {
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
