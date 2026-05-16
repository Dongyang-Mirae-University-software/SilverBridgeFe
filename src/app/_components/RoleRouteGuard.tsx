'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AuthRole, getAccessToken, getAuthRole } from '@/lib/auth/tokenStore';

interface Props {
  allowedRole: AuthRole;
  children: ReactNode;
}

export default function RoleRouteGuard({ allowedRole, children }: Props) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const accessToken = getAccessToken();
    const role = getAuthRole();

    if (!accessToken) {
      router.replace('/login');
      return;
    }

    if (role !== allowedRole) {
      router.replace('/');
      return;
    }

    setIsChecking(false);
  }, [allowedRole, router]);

  if (isChecking) return null;

  return children;
}
