import { AuthRole } from './tokenStore';

export function getRoleHomePath(role: AuthRole) {
  return role === 'WARD' ? '/ward' : '/guardian';
}

export function getRoleLabel(role: AuthRole) {
  return role === 'WARD' ? '피보호자' : '보호자';
}
