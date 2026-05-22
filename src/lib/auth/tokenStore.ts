let accessToken: string | null = null;
let refreshToken: string | null = null;
let authRole: AuthRole | null = null;

const ACCESS_TOKEN_KEY = 'careai_access_token';
const REFRESH_TOKEN_KEY = 'careai_refresh_token';
const AUTH_ROLE_KEY = 'careai_auth_role';

export type AuthRole = 'WARD' | 'GUARDIAN' | 'ADMIN';

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string; role?: AuthRole }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  authRole = tokens.role ?? authRole;

  const storage = getSessionStorage();
  storage?.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage?.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  if (tokens.role) storage?.setItem(AUTH_ROLE_KEY, tokens.role);
}

export function setAuthRole(role: AuthRole) {
  authRole = role;

  const storage = getSessionStorage();
  storage?.setItem(AUTH_ROLE_KEY, role);
}

export function getAccessToken() {
  if (accessToken) return accessToken;

  const storage = getSessionStorage();
  accessToken = storage?.getItem(ACCESS_TOKEN_KEY) ?? null;

  return accessToken;
}

export function getRefreshToken() {
  if (refreshToken) return refreshToken;

  const storage = getSessionStorage();
  refreshToken = storage?.getItem(REFRESH_TOKEN_KEY) ?? null;

  return refreshToken;
}

export function getAuthRole() {
  if (authRole) return authRole;

  const storage = getSessionStorage();
  authRole = (storage?.getItem(AUTH_ROLE_KEY) as AuthRole | null) ?? null;

  return authRole;
}

export function getAccessTokenSubject() {
  if (typeof window === 'undefined') return null;

  const token = getAccessToken();
  const payload = token?.split('.')[1];
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(window.atob(paddedPayload)) as { sub?: unknown };

    return typeof decodedPayload.sub === 'string' ? decodedPayload.sub : null;
  } catch {
    return null;
  }
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
  authRole = null;

  const storage = getSessionStorage();
  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
  storage?.removeItem(AUTH_ROLE_KEY);
}
