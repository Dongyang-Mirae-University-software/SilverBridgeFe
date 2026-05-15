'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

async function hasActiveCookieSession() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const response = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return false;

  const data = await response.json().catch(() => null);

  return data?.success === true;
}

export default function AuthRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      const accessToken = localStorage.getItem('access_token');

      if (accessToken) {
        router.replace('/');
        return;
      }

      try {
        const hasSession = await hasActiveCookieSession();

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
