// ─────────────────────────────────────────────
// lib/api/errorHandler.ts
//
// AxiosError를 받아서 우리가 원하는 에러 형태로 변환하는 파일
// interceptor에서 이 함수만 호출하면 에러 처리 끝
// ─────────────────────────────────────────────

import { AxiosError } from 'axios';

// 서버가 내려주는 에러 응답 형태 (백엔드와 협의된 스펙)
export interface ServerErrorBody {
  code?: string;
  message?: string;
}

// 우리가 앱 전체에서 쓸 에러 형태
// - status  : HTTP 상태 코드 (400, 401, 500 ...)
// - message : UI에 그대로 보여줄 수 있는 한국어 메시지
// - code    : 서버가 내려준 에러 코드 (있을 때만)
export interface ApiErrorShape {
  status: number;
  message: string;
  code?: string;
}

// status별로 유저에게 보여줄 메시지 모음
// 여기만 수정하면 전체 에러 메시지가 바뀜
const ERROR_MESSAGES: Record<number, string> = {
  400: '요청이 올바르지 않아요. 입력값을 확인해주세요.',
  401: '로그인이 필요해요.',
  403: '접근 권한이 없어요.',
  404: '요청한 정보를 찾을 수 없어요.',
  409: '이미 처리된 요청입니다.',
  500: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
};

// ── 메인 함수 ─────────────────────────────────
// AxiosError를 받아서 ApiErrorShape으로 변환해서 반환
// interceptor에서 이 함수 호출 후 Promise.reject()에 넘김
export function resolveError(error: AxiosError<ServerErrorBody>): ApiErrorShape {
  const status = error.response?.status ?? 0;
  const code = error.response?.data?.code;

  return {
    status,
    code,
    // 서버가 메시지를 내려주면 그걸 쓰고, 없으면 우리가 정의한 메시지 사용
    message: error.response?.data?.message ?? ERROR_MESSAGES[status] ?? '알 수 없는 오류가 발생했어요.',
  };
}
