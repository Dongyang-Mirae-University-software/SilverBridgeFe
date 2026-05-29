'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { clearAuthTokens } from '@/lib/auth/tokenStore';

export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const redirectToLogin = () => {
      clearAuthTokens();
      queryClient.clear();
      if (window.location.pathname !== '/login') router.replace('/login');
    };

    window.addEventListener('careai:auth-expired', redirectToLogin);

    return () => {
      window.removeEventListener('careai:auth-expired', redirectToLogin);
    };
  }, [queryClient, router]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
