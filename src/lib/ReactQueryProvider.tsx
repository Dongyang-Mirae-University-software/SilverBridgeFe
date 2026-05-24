'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';

export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const handleAuthExpired = () => {
      queryClient.clear();
    };

    window.addEventListener('careai:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('careai:auth-expired', handleAuthExpired);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
