// ─────────────────────────────────────────────
// lib/api/apiClient.ts
//
// axios instance를 만들고 interceptor를 붙이는 파일
// 서비스나 훅에서 이걸 import해서 apiClient.get(...) 형태로 쓰면 됨
// ─────────────────────────────────────────────

import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { resolveError, ServerErrorBody } from './errorHandler';
import { CommonResponse } from '@/service/interface/common';
import { IAuthTokenResponse } from '@/service/interface/auth';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from '@/lib/auth/tokenStore';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

function getApiBaseUrl() {
  const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN?.replace(/\/$/, '');
  const isLocalBrowser =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (!apiDomain || isLocalBrowser) return '/api';

  return `${apiDomain}/api`;
}

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  withCredentials: true, // 쿠키 기반 인증 쓸 때 필요 (아니면 제거)
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
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

function isUserDeleteRequest(config?: RetryableRequestConfig) {
  if (!config?.url) return false;

  return config.method?.toLowerCase() === 'delete' && config.url.includes('/user/me');
}

function shouldRefreshOnUnauthorized(config?: RetryableRequestConfig): config is RetryableRequestConfig {
  if (!config) return false;
  if (config._retry) return false;
  if (config.url?.includes('/auth/refresh')) return false;
  if (isSigninRequest(config.url)) return false;
  if (isUserDeleteRequest(config)) return false;

  return true;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearSession();
    throw new Error('리프레시 토큰이 없습니다.');
  }

  if (!refreshRequest) {
    refreshRequest = refreshClient
      .post<CommonResponse<IAuthTokenResponse>>('/auth/refresh', { refreshToken })
      .then(response => {
        const responseBody = response.data;
        const tokens = responseBody.data;
        const isSuccess = responseBody.success === true || responseBody.code === 200;

        if (!isSuccess || !tokens?.accessToken || !tokens.refreshToken) {
          throw new Error(responseBody.message || '토큰 재발급에 실패했습니다.');
        }

        setAuthTokens({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });

        return tokens.accessToken;
      })
      .catch(error => {
        clearSession();
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
    if (token && !isSigninRequest(config.url)) {
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

    if (isUnauthorized && !isSigninEndpoint) {
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
