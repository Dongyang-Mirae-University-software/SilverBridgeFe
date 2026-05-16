let accessToken: string | null = null;
let refreshToken: string | null = null;

const ACCESS_TOKEN_KEY = 'careai_access_token';
const REFRESH_TOKEN_KEY = 'careai_refresh_token';

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;

  const storage = getSessionStorage();
  storage?.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage?.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
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

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;

  const storage = getSessionStorage();
  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
}
