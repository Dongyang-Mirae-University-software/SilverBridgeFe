import { clearConversations } from '@/store/chatConversationStore';
import { clearSelectedWardId } from '@/store/selectedWardStore';
import { decodeAccessTokenClaims } from './tokenClaims';

let accessToken: string | null = null;
let authRole: AuthRole | null = null;

const ACCESS_TOKEN_KEY = 'careai_access_token';
// 로그인 세션이 있다는 표시(값 '1'). refresh 토큰은 백엔드가 내리는 HttpOnly 쿠키(careai_rt, Path=/api/auth)에만 있어
// 화면 코드가 읽을 수 없다(2026-11-10 전체 점검 S-1). 이 표시는 "갱신을 시도해 볼 만한가"만 알려 준다 - 토큰이 아니다.
const SESSION_KEY = 'careai_session';
// 로그인한 역할(WARD·GUARDIAN·ADMIN). 서비스 워커가 알림을 눌렀을 때 열 화면을 고르는 데만 쓴다 -
// access 쿠키가 30분 뒤 사라져도 역할은 알 수 있게 한다. 권한 판단에는 쓰지 않는다(화면은 /me 응답, 데이터는 백엔드가 판단)
const ROLE_HINT_KEY = 'careai_role';
// 예전에 화면이 직접 저장하던 refresh 토큰 쿠키. 더는 쓰지 않으며 보이면 지운다
const LEGACY_REFRESH_TOKEN_KEY = 'careai_refresh_token';
const LEGACY_AUTH_ROLE_KEY = 'careai_auth_role';
// "로그인 유지"를 끈 로그인 표시. 세션 쿠키라 브라우저를 닫으면 토큰·세션 표시 쿠키와 함께 사라진다.
// 토큰이 아니라 따로 두는 이유: 갱신(setAuthTokens)·읽기 때 다시 쓰는 쿠키도 처음 고른 방식을 따라야 한다
const SESSION_ONLY_KEY = 'careai_session_only';
// "로그인 유지"를 끈 로그인의 흔적(7일). 브라우저를 닫으면 위 쿠키들은 사라지지만 HttpOnly refresh 쿠키는 7일 남는다 -
// 다음에 로그인 화면이 열릴 때 이 흔적을 보고 남은 세션을 서버에서 끝낸다(endLeftoverSession)
const SESSION_ONLY_TRACE_KEY = 'careai_session_trace';
const PERSISTENT_MAX_AGE_SECONDS = 604800;
// access 토큰의 만료 시각을 읽지 못할 때 쓰는 쿠키 수명(access 토큰 수명과 같은 30분)
const ACCESS_FALLBACK_MAX_AGE_SECONDS = 1800;

export type AuthRole = 'WARD' | 'GUARDIAN' | 'ADMIN';

function isSessionOnlyLogin() {
  return getCookie(SESSION_ONLY_KEY) === '1';
}

// maxAgeSeconds 가 null 이면 세션 쿠키(브라우저를 닫으면 사라짐). https 에서는 Secure 를 붙인다
function setCookie(name: string, value: string, maxAgeSeconds: number | null) {
  if (typeof document === 'undefined') return;
  const maxAge = maxAgeSeconds === null ? '' : `; max-age=${maxAgeSeconds}`;
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/${maxAge}; SameSite=Lax${secure}`;
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
  if (remember) {
    removeCookie(SESSION_ONLY_KEY);
    removeCookie(SESSION_ONLY_TRACE_KEY);
  } else {
    setCookie(SESSION_ONLY_KEY, '1', null);
    setCookie(SESSION_ONLY_TRACE_KEY, '1', PERSISTENT_MAX_AGE_SECONDS);
  }
}

// access 토큰 쿠키는 토큰이 살아 있는 동안만 둔다(로그인 유지를 끈 로그인은 세션 쿠키)
function getAccessCookieMaxAge(token: string, sessionOnly: boolean) {
  if (sessionOnly) return null;

  const exp = decodeAccessTokenClaims(token)?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return ACCESS_FALLBACK_MAX_AGE_SECONDS;
  return Math.max(1, Math.min(PERSISTENT_MAX_AGE_SECONDS, Math.floor(exp - Date.now() / 1000)));
}

function writeSessionCookies(token: string) {
  const sessionOnly = isSessionOnlyLogin();
  setCookie(ACCESS_TOKEN_KEY, token, getAccessCookieMaxAge(token, sessionOnly));
  setCookie(SESSION_KEY, '1', sessionOnly ? null : PERSISTENT_MAX_AGE_SECONDS);

  const role = decodeAccessTokenClaims(token)?.role;
  if (role === 'WARD' || role === 'GUARDIAN' || role === 'ADMIN') {
    setCookie(ROLE_HINT_KEY, role, sessionOnly ? null : PERSISTENT_MAX_AGE_SECONDS);
  }
}

// 예전 버전이 남긴 refresh 토큰 쿠키·sessionStorage 값을 지운다. 그때 로그인한 사람은 HttpOnly 쿠키도 이미 받았으므로
// (백엔드가 2026-10-06부터 함께 내렸다) 세션 표시만 새로 달아 로그인을 유지한다
function migrateLegacyRefreshToken() {
  const storage = getSessionStorage();
  storage?.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  if (getCookie(LEGACY_REFRESH_TOKEN_KEY) === null) return;

  removeCookie(LEGACY_REFRESH_TOKEN_KEY);
  if (getCookie(SESSION_KEY) !== '1') setCookie(SESSION_KEY, '1', isSessionOnlyLogin() ? null : PERSISTENT_MAX_AGE_SECONDS);
}

// remember 는 로그인할 때만 넘긴다. 갱신은 생략해 처음 고른 방식(유지/브라우저 닫으면 로그아웃)을 그대로 쓴다.
// refresh 토큰은 받지 않는다 - 응답 본문에 실려 와도 저장하지 않는다(HttpOnly 쿠키로만 오간다)
export function setAuthTokens(tokens: { accessToken: string; role?: AuthRole; remember?: boolean }) {
  if (tokens.remember !== undefined) setLoginPersistence(tokens.remember);

  accessToken = tokens.accessToken;
  authRole = tokens.role ?? authRole;
  // 다른 계정으로 로그인하면 앞 사람의 챗봇 대화를 지운다(같은 사람의 토큰 갱신이면 남긴다)
  const subject = decodeAccessTokenClaims(tokens.accessToken)?.sub;
  clearConversations(typeof subject === 'string' ? subject : null);

  const storage = getSessionStorage();
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);
  migrateLegacyRefreshToken();
  writeSessionCookies(tokens.accessToken);
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

  return accessToken;
}

// 갱신(POST /api/auth/refresh)을 시도해 볼 로그인 세션이 있는가. 실제 유효성은 서버가 HttpOnly 쿠키로 판단한다
export function hasSession() {
  migrateLegacyRefreshToken();
  return getCookie(SESSION_KEY) === '1';
}

// "로그인 유지"를 끈 로그인의 흔적만 남았는가(브라우저를 닫았다 연 뒤) - 서버에 남은 세션을 끝낼 차례
export function hasLeftoverSessionTrace() {
  return !hasSession() && getCookie(SESSION_ONLY_TRACE_KEY) === '1';
}

export function clearLeftoverSessionTrace() {
  removeCookie(SESSION_ONLY_TRACE_KEY);
}

// 다른 탭이 갱신·로그아웃하면 쿠키만 바뀌고 이 탭의 메모리 값은 그대로다. 메모리를 버리고 저장소에서 다시 읽는다
export function reloadAuthTokensFromStorage() {
  accessToken = null;

  return { accessToken: getAccessToken(), hasSession: hasSession() };
}

export function getAuthRole() {
  const storage = getSessionStorage();
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);

  return authRole;
}

export function getAccessTokenSubject() {
  if (typeof window === 'undefined') return null;

  const sub = decodeAccessTokenClaims(getAccessToken())?.sub;
  return typeof sub === 'string' ? sub : null;
}

export function clearAuthTokens() {
  accessToken = null;
  authRole = null;

  const storage = getSessionStorage();
  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  storage?.removeItem(LEGACY_AUTH_ROLE_KEY);
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(SESSION_KEY);
  removeCookie(ROLE_HINT_KEY);
  removeCookie(LEGACY_REFRESH_TOKEN_KEY);
  removeCookie(SESSION_ONLY_KEY);
  removeCookie(SESSION_ONLY_TRACE_KEY);
  // 다음에 이 탭으로 로그인하는 사람에게 앞 사람이 고른 피보호자가 남지 않게 한다
  clearSelectedWardId();
  clearConversations();
}
