let accessToken: string | null = null;
let refreshToken: string | null = null;
let authRole: AuthRole | null = null;

const ACCESS_TOKEN_KEY = 'careai_access_token';
const REFRESH_TOKEN_KEY = 'careai_refresh_token';
const LEGACY_AUTH_ROLE_KEY = 'careai_auth_role';

export type AuthRole = 'WARD' | 'GUARDIAN' | 'ADMIN';

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return null;

  const cookie = document.cookie
    .split('; ')
    .find(item => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split('=')[1] ?? '') : null;
}

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string; role?: AuthRole }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  authRole = tokens.role ?? authRole;

  const storage = getSessionStorage();
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);
  setCookie(ACCESS_TOKEN_KEY, tokens.accessToken);
  setCookie(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function setAuthRole(role: AuthRole) {
  authRole = role;

  const storage = getSessionStorage();
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);
}

export function getAccessToken() {
  if (accessToken) return accessToken;

  const storage = getSessionStorage();
  accessToken = getCookie(ACCESS_TOKEN_KEY) ?? storage?.getItem(ACCESS_TOKEN_KEY) ?? null;
  if (accessToken) setCookie(ACCESS_TOKEN_KEY, accessToken);

  return accessToken;
}

export function getRefreshToken() {
  if (refreshToken) return refreshToken;

  const storage = getSessionStorage();
  refreshToken = getCookie(REFRESH_TOKEN_KEY) ?? storage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  if (refreshToken) setCookie(REFRESH_TOKEN_KEY, refreshToken);

  return refreshToken;
}

export function getAuthRole() {
  const storage = getSessionStorage();
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);

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
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
}
