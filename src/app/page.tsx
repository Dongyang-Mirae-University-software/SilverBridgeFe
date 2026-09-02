import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getRoleHomePath } from '@/utils/auth/routes';
import type { AuthRole } from '@/lib/auth/tokenStore';

const ACCESS_TOKEN_KEY = 'careai_access_token';

export default async function Home() {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_KEY)?.value;
  const role = getRoleFromAccessToken(accessToken);

  redirect(role ? getRoleHomePath(role) : '/login');
}

function getRoleFromAccessToken(token?: string): AuthRole | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8')) as {
      exp?: unknown;
      role?: unknown;
    };

    if (typeof decodedPayload.exp === 'number' && decodedPayload.exp * 1000 <= Date.now()) return null;
    if (decodedPayload.role === 'WARD' || decodedPayload.role === 'GUARDIAN' || decodedPayload.role === 'ADMIN') return decodedPayload.role;
  } catch {
    return null;
  }

  return null;
}
