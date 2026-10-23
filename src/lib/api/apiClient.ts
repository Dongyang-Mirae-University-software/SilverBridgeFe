// ─────────────────────────────────────────────
// lib/api/apiClient.ts
//
// axios instance를 만들고 interceptor를 붙이는 파일
// 서비스나 훅에서 이걸 import해서 apiClient.get(...) 형태로 쓰면 됨
// ─────────────────────────────────────────────

import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { resolveError, ServerErrorBody } from './errorHandler';
import { CommonResponse } from '@/service/interface/common';
import { IAuthTokenResponse } from '@/service/interface/auth/auth';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  reloadAuthTokensFromStorage,
  setAuthTokens,
} from '@/lib/auth/tokenStore';
import { isAccessTokenExpired } from '@/lib/auth/tokenExpiry';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  withCredentials: true, // 쿠키 기반 인증 쓸 때 필요 (아니면 제거)
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshRequest: Promise<string> | null = null;

function clearReactQueryCache() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('careai:auth-expired'));
}

function clearSession() {
  clearAuthTokens();
  clearReactQueryCache();
}

function setBearerToken(config: InternalAxiosRequestConfig, token: string) {
  const headers = AxiosHeaders.from(config.headers);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;
}

function isSigninRequest(url?: string) {
  if (!url) return false;

  return url.includes('/auth/signin');
}

function isRefreshRequest(url?: string) {
  if (!url) return false;

  return url.includes('/auth/refresh');
}

function isPublicAuthRequest(url?: string) {
  if (!url) return false;

  return (
    url.includes('/auth/find-password') ||
    url.includes('/auth/find-email') ||
    url.includes('/auth/password/reset') ||
    url.includes('/auth/signup')
  );
}

function isUserDeleteRequest(config?: RetryableRequestConfig) {
  if (!config?.url) return false;

  return config.method?.toLowerCase() === 'delete' && config.url.includes('/user/me');
}

function isUserPasswordChangeRequest(config?: RetryableRequestConfig) {
  if (!config?.url) return false;

  return config.method?.toLowerCase() === 'put' && config.url.includes('/user/me/password');
}

function shouldRefreshOnUnauthorized(config?: RetryableRequestConfig): config is RetryableRequestConfig {
  if (!config) return false;
  if (config._retry) return false;
  if (isRefreshRequest(config.url)) return false;
  if (isSigninRequest(config.url)) return false;
  if (isPublicAuthRequest(config.url)) return false;
  if (isUserDeleteRequest(config)) return false;
  if (isUserPasswordChangeRequest(config)) return false;

  return true;
}

// 서버가 이 세션을 받아 주지 않는 경우(refresh 토큰 없음·만료·폐기). 이때만 세션을 지우고 로그인 화면으로 보낸다
export class SessionRejectedError extends Error {}

const SESSION_REJECTED_STATUSES = new Set([401, 403, 404]);
const REFRESH_LOCK_NAME = 'careai-token-refresh';

// 갱신 실패 중 세션을 지워야 하는 것만 true. 429·5xx·시간 초과·네트워크 오류는 일시 장애라
// 세션을 남겨 두고 다시 시도하게 한다(일시 장애로 로그아웃시키지 않는다)
export function isSessionRejected(error: unknown) {
  if (error instanceof SessionRejectedError) return true;

  const status = (error as AxiosError | undefined)?.response?.status;
  return status !== undefined && SESSION_REJECTED_STATUSES.has(status);
}

// BE는 refresh 토큰을 회전하고 재사용을 감지한다. 같은 토큰으로 두 번 부르면 세션이 끊기므로
// 탭끼리도 한 번에 하나만 갱신한다(Web Locks). 지원하지 않는 브라우저는 탭 안 직렬화(refreshRequest)만 남는다
async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks?.request) return task();

  let result!: T;
  await locks.request(REFRESH_LOCK_NAME, async () => {
    result = await task();
  });
  return result;
}

async function requestTokenRefresh(knownRefreshToken: string) {
  // 락을 기다리는 사이 다른 탭이 먼저 갱신했으면 쿠키의 refresh 토큰이 바뀌어 있다.
  // 회전된 옛 토큰으로 다시 부르지 않고 그 탭이 받은 토큰을 쓴다(그 access 토큰도 만료됐으면 새 refresh 토큰으로 갱신)
  const stored = reloadAuthTokensFromStorage();
  if (!stored.refreshToken) throw new SessionRejectedError('리프레시 토큰이 없습니다.');
  if (stored.refreshToken !== knownRefreshToken && stored.accessToken && !isAccessTokenExpired(stored.accessToken)) {
    return stored.accessToken;
  }

  const response = await refreshClient.post<CommonResponse<IAuthTokenResponse>>('/auth/refresh', {
    refreshToken: stored.refreshToken,
  });
  const responseBody = response.data;
  const tokens = responseBody.data;
  const isSuccess = responseBody.success === true || responseBody.code === 200;

  if (!isSuccess || !tokens?.accessToken || !tokens.refreshToken) {
    throw new SessionRejectedError(responseBody.message || '토큰 재발급에 실패했습니다.');
  }

  setAuthTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });

  return tokens.accessToken;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearSession();
    throw new SessionRejectedError('리프레시 토큰이 없습니다.');
  }

  if (!refreshRequest) {
    refreshRequest = withRefreshLock(() => requestTokenRefresh(refreshToken))
      .catch(error => {
        if (isSessionRejected(error)) clearSession();
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

// ── request interceptor ───────────────────────
// 요청을 보내기 전에 실행됨
// 주로 토큰을 헤더에 붙이는 용도로 씀
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    // 토큰이 있으면 Authorization 헤더에 자동으로 붙여줌
    if (token && !isSigninRequest(config.url) && !isRefreshRequest(config.url) && !isPublicAuthRequest(config.url)) {
      setBearerToken(config, token);
    }

    return config;
  },
  // 요청 자체를 못 보낸 경우 (거의 발생 안 하지만 처리는 해둬야 함)
  (error: AxiosError) => Promise.reject(error),
);

// ── response interceptor ──────────────────────
// 응답이 돌아왔을 때 실행됨
apiClient.interceptors.response.use(
  response => {
    const data = response.data;
    return data;
  },

  // ❌ 실패 (4xx, 5xx): errorHandler가 변환한 에러 객체로 reject
  // catch 블록에서 error.message, error.status 바로 꺼내 쓸 수 있음
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    const isSigninEndpoint = isSigninRequest(originalRequest?.url);
    const isPublicAuthEndpoint = isPublicAuthRequest(originalRequest?.url);
    const isDeleteAccountEndpoint = isUserDeleteRequest(originalRequest);
    const isPasswordChangeEndpoint = isUserPasswordChangeRequest(originalRequest);

    if (isUnauthorized && shouldRefreshOnUnauthorized(originalRequest)) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        setBearerToken(originalRequest, newAccessToken);

        return apiClient(originalRequest);
      } catch {
        const apiError = resolveError(error as AxiosError<ServerErrorBody>);
        error.message = apiError.message;
        return Promise.reject(error);
      }
    }

    if (isUnauthorized && !isSigninEndpoint && !isPublicAuthEndpoint && !isDeleteAccountEndpoint && !isPasswordChangeEndpoint) {
      clearSession();
    }

    const apiError = resolveError(error as AxiosError<ServerErrorBody>);
    error.message = apiError.message;
    return Promise.reject(error);
  },
);

export { apiClient };

// ─────────────────────────────────────────────
// 사용 예시
// ─────────────────────────────────────────────
//
// 서비스 레이어에서:
//   const userService = {
//     getUser: (id: number) => apiClient.get<User>(`/users/${id}`),
//     createUser: (body: CreateUserBody) => apiClient.post<User>('/users', body),
//   };
//
// 컴포넌트나 훅에서:
//   try {
//     const user = await userService.getUser(1);
//   } catch (error) {
//     const { status, message } = error as ApiErrorShape;
//     toast.error(message); // "요청한 정보를 찾을 수 없어요."
//   }
