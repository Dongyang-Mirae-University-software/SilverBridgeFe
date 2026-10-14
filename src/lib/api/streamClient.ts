import axios, { type InternalAxiosRequestConfig } from 'axios';

import { refreshAccessToken } from '@/lib/api/apiClient';

export const streamClient = axios.create({
  baseURL: '/api/streams',
  timeout: 10 * 60 * 1000,
  headers: { 'Content-Type': 'application/json' },
});

type RetryableConfig = InternalAxiosRequestConfig & { _streamRetry?: boolean };

// 프록시는 careai_access_token 쿠키로 로그인을 확인한다. 401이면 토큰이 만료된 것이므로
// 재발급(쿠키 갱신)을 한 번만 하고 같은 요청을 다시 보낸다. 429·5xx는 여기서 재시도하지 않는다
// (호출부가 Retry-After만큼 쉰다) - 재시도하면 속도 제한을 더 악화시킨다.
streamClient.interceptors.response.use(
  response => response,
  async error => {
    const config = error?.config as RetryableConfig | undefined;
    if (error?.response?.status !== 401 || !config || config._streamRetry) return Promise.reject(error);

    config._streamRetry = true;
    try {
      await refreshAccessToken();
    } catch {
      return Promise.reject(error);
    }
    return streamClient(config);
  },
);

// 429 응답의 Retry-After(초 또는 HTTP 날짜)를 밀리초로. 없거나 이상하면 기본값.
export function getRetryAfterMs(error: unknown, fallbackMs = 2000) {
  const header = (error as { response?: { headers?: Record<string, unknown> } })?.response?.headers?.['retry-after'];
  if (typeof header !== 'string') return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return fallbackMs;
  return Math.min(Math.max(date - Date.now(), 0), 60_000);
}

export function getHttpStatus(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}
