let accessToken: string | null = null;
let refreshToken: string | null = null;
let authRole: AuthRole | null = null;

const ACCESS_TOKEN_KEY = 'careai_access_token';
const REFRESH_TOKEN_KEY = 'careai_refresh_token';
const LEGACY_AUTH_ROLE_KEY = 'careai_auth_role';
// "로그인 유지"를 끈 로그인 표시. 세션 쿠키라 브라우저를 닫으면 토큰 쿠키와 함께 사라진다.
// 토큰이 아니라 따로 두는 이유: 갱신(setAuthTokens)·읽기 때 다시 쓰는 쿠키도 처음 고른 방식을 따라야 한다
const SESSION_ONLY_KEY = 'careai_session_only';
const PERSISTENT_MAX_AGE_SECONDS = 604800;

export type AuthRole = 'WARD' | 'GUARDIAN' | 'ADMIN';

function isSessionOnlyLogin() {
  return getCookie(SESSION_ONLY_KEY) === '1';
}

// 로그인 유지(기본)는 7일, 유지를 끈 로그인은 max-age 없는 세션 쿠키로 쓴다
function setCookie(name: string, value: string, sessionOnly = isSessionOnlyLogin()) {
  if (typeof document === 'undefined') return;
  const maxAge = sessionOnly ? '' : `; max-age=${PERSISTENT_MAX_AGE_SECONDS}`;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/${maxAge}; SameSite=Lax`;
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

function setLoginPersistence(remember: boolean) {
  if (remember) removeCookie(SESSION_ONLY_KEY);
  else setCookie(SESSION_ONLY_KEY, '1', true);
}

// remember 는 로그인할 때만 넘긴다. 갱신은 생략해 처음 고른 방식(유지/브라우저 닫으면 로그아웃)을 그대로 쓴다
export function setAuthTokens(tokens: { accessToken: string; refreshToken: string; role?: AuthRole; remember?: boolean }) {
  if (tokens.remember !== undefined) setLoginPersistence(tokens.remember);

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

// 다른 탭이 갱신·로그아웃하면 쿠키만 바뀌고 이 탭의 메모리 값은 그대로다. 메모리를 버리고 저장소에서 다시 읽는다
export function reloadAuthTokensFromStorage() {
  accessToken = null;
  refreshToken = null;

  return { accessToken: getAccessToken(), refreshToken: getRefreshToken() };
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
  removeCookie(SESSION_ONLY_KEY);
}
