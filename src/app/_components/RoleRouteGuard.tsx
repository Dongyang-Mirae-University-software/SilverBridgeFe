'use client';

import { ReactNode, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import { AuthRole, getAccessToken, getAuthRole } from '@/lib/auth/tokenStore';

interface Props {
  allowedRole: AuthRole;
  children: ReactNode;
}

function subscribeAuthStore() {
  return () => {};
}

function getAuthSnapshot() {
  const hasAccessToken = getAccessToken() ? '1' : '0';
  const role = getAuthRole() ?? 'none';

  return `${hasAccessToken}:${role}`;
}

function getServerAuthSnapshot() {
  return '0:none';
}

export default function RoleRouteGuard({ allowedRole, children }: Props) {
  const router = useRouter();
  const authSnapshot = useSyncExternalStore(subscribeAuthStore, getAuthSnapshot, getServerAuthSnapshot);
  const [hasAccessTokenValue, roleValue] = authSnapshot.split(':');
  const hasAccessToken = hasAccessTokenValue === '1';
  const role = roleValue === 'none' ? null : (roleValue as AuthRole);
  const isAllowed = hasAccessToken && role === allowedRole;

  useEffect(() => {
    if (!hasAccessToken) {
      router.replace('/login');
      return;
    }

    if (role !== allowedRole) {
      router.replace('/');
    }
  }, [allowedRole, hasAccessToken, role, router]);

  if (!isAllowed) return null;

  return children;
}
