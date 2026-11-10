import { getSafeReturnPath } from './returnPath';

// 카카오 로그인 state. 로그인을 시작한 브라우저에만 있는 난수를 쿠키에 두고 state 에 함께 실어 보낸 뒤,
// 돌아왔을 때 둘이 같은지 본다 - 남이 만든 콜백 주소(자기 인가 코드)를 열게 해 그 사람 계정으로 로그인시키는 것을 막는다
// (2026-11-10 전체 점검 S-5). 형식: "<난수>" 또는 "<난수>:<돌아갈 경로>"
export const KAKAO_STATE_COOKIE = 'careai_oauth_state';
export const KAKAO_STATE_MAX_AGE_SECONDS = 600;

const NONCE_PATTERN = /^[0-9a-f]{32}$/;

export function buildKakaoState(nonce: string, returnTo: string | null) {
  return returnTo ? `${nonce}:${returnTo}` : nonce;
}

// 형식이 틀리면 null. returnTo 는 같은 출처 경로만 남긴다
export function parseKakaoState(state: string | null | undefined): { nonce: string; returnTo: string | null } | null {
  if (!state) return null;

  const separator = state.indexOf(':');
  const nonce = separator === -1 ? state : state.slice(0, separator);
  if (!NONCE_PATTERN.test(nonce)) return null;

  return { nonce, returnTo: separator === -1 ? null : getSafeReturnPath(state.slice(separator + 1)) };
}

// 돌아온 state 가 이 브라우저가 시작한 로그인의 것인가
export function isKakaoStateTrusted(state: string | null | undefined, cookieNonce: string | null | undefined) {
  const parsed = parseKakaoState(state);
  return Boolean(parsed && cookieNonce && parsed.nonce === cookieNonce);
}
