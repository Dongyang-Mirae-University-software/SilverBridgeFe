// ─────────────────────────────────────────────
// lib/api/apiClient.ts
//
// axios instance를 만들고 interceptor를 붙이는 파일
// 서비스나 훅에서 이걸 import해서 apiClient.get(...) 형태로 쓰면 됨
// ─────────────────────────────────────────────

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { resolveError, ServerErrorBody } from './errorHandler';
import { getAccessToken } from '@/lib/auth/tokenStore';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 10_000,
  withCredentials: true, // 쿠키 기반 인증 쓸 때 필요 (아니면 제거)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── request interceptor ───────────────────────
// 요청을 보내기 전에 실행됨
// 주로 토큰을 헤더에 붙이는 용도로 씀
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    // 토큰이 있으면 Authorization 헤더에 자동으로 붙여줌
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
  (error: AxiosError) => {
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
