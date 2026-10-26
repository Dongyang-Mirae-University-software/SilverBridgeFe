import { AuthRole } from '@/lib/auth/tokenStore';

export function getRoleHomePath(role: AuthRole) {
  if (role === 'WARD') return '/ward';
  if (role === 'GUARDIAN') return '/guardian';

  if (role === 'ADMIN') return '/admin';

  return '/login';
}

export function getRoleLabel(role: AuthRole) {
  if (role === 'WARD') return '피보호자';
  if (role === 'GUARDIAN') return '보호자';

  return '관리자';
}
