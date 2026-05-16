let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
}
