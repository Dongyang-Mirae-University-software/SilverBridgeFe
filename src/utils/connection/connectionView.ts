// 가족(연결) 화면 공용 표시 규칙 - 오류 문구·관계 문장·날짜·나이

import { getDirectionParticle } from '@/utils/format/korean';

interface ConnectionErrorBody {
  code?: string;
  message?: string;
  data?: { retryAfterSeconds?: number | string } | null;
}

interface ConnectionErrorLike {
  message?: string;
  response?: { status?: number; data?: ConnectionErrorBody; headers?: Record<string, unknown> };
}

// 서버 오류 코드별 안내. 분기는 문구가 아니라 code로 한다(BE 문구는 바뀔 수 있다)
const REQUEST_ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: '이 회원 ID로 가입한 분이 없어요. 대소문자까지 똑같이 입력했는지 확인해 주세요.',
  INVALID_CONNECTION_ROLE: '어르신 계정의 회원 ID가 아니에요.',
  CANNOT_CONNECT_SELF: '내 회원 ID로는 요청할 수 없어요.',
  CONNECTION_TARGET_NOT_ACTIVE: '지금은 연결할 수 없는 계정이에요.',
  CONNECTION_ALREADY_EXISTS: '이미 연결됐거나 수락을 기다리는 중이에요.',
};

export const CONNECTION_COOLDOWN_CODE = 'CONNECTION_REQUEST_COOLDOWN';

function getErrorBody(error: unknown) {
  return (error as ConnectionErrorLike | null)?.response?.data;
}

export function getConnectionErrorCode(error: unknown) {
  return getErrorBody(error)?.code;
}

// 429의 남은 시간: 본문 data.retryAfterSeconds 우선, 없으면 Retry-After 헤더
export function getRetryAfterSeconds(error: unknown): number | null {
  const fromBody = Number(getErrorBody(error)?.data?.retryAfterSeconds);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;

  const header = (error as ConnectionErrorLike | null)?.response?.headers?.['retry-after'];
  const fromHeader = Number(header);
  return Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : null;
}

// 남은 초를 "N시간 M분"으로 - 1분 미만은 "1분"으로 올린다
export function formatRetryAfter(seconds: number) {
  const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
}

export function getConnectionRequestErrorMessage(error: unknown) {
  const code = getConnectionErrorCode(error);

  if (code === CONNECTION_COOLDOWN_CODE) {
    const seconds = getRetryAfterSeconds(error);
    // 남은 시간을 모르면 단정하지 않는다 - 24시간 고정 창의 남은 시간이라 몇 분 뒤일 수도 있다
    const wait = seconds ? `${formatRetryAfter(seconds)} 뒤에` : '잠시 뒤에';
    return `같은 분께 요청을 너무 여러 번 보냈어요. ${wait} 다시 요청할 수 있어요.`;
  }

  if (code && REQUEST_ERROR_MESSAGES[code]) return REQUEST_ERROR_MESSAGES[code];
  return getErrorBody(error)?.message || (error as Error | null)?.message || '연결 요청에 실패했어요. 잠시 후 다시 시도해 주세요.';
}

// 1단계 회원 ID 확인(GET /api/guardian/connection/preview) 결과 - 2026-11-25 R-2
// blocked: 상대 계정 때문에 이 ID로는 요청할 수 없다 → [다음]을 막는다(같은 검사를 실제 요청도 한다)
// rateLimited·unknown: 확인만 못 했을 뿐이다 → [다음]은 그대로 둔다(실제 요청 때 서버가 다시 검사한다)
export type PreviewCheck =
  | { kind: 'blocked'; message: string }
  | { kind: 'rateLimited'; message: string }
  | { kind: 'unknown'; message: string };

// 확인 조회가 내는 상대 계정 오류. 반복 요청 제한(COOLDOWN)은 실제 요청에서만 나와 넣지 않는다
const PREVIEW_BLOCKING_CODES = new Set([
  'USER_NOT_FOUND',
  'INVALID_CONNECTION_ROLE',
  'CANNOT_CONNECT_SELF',
  'CONNECTION_TARGET_NOT_ACTIVE',
  'CONNECTION_ALREADY_EXISTS',
]);

export function getPreviewCheck(error: unknown): PreviewCheck {
  const code = getConnectionErrorCode(error);
  const status = (error as ConnectionErrorLike | null)?.response?.status;

  // 확인 조회는 1분에 10번까지다 - 넘었다고 "연결할 수 없어요"로 안내하면 거짓이 된다
  if (status === 429 || code === 'TOO_MANY_REQUESTS') {
    const seconds = getRetryAfterSeconds(error);
    const wait = seconds ? `${formatRetryAfter(seconds)} 뒤에` : '잠시 뒤에';
    return { kind: 'rateLimited', message: `확인을 너무 여러 번 했어요. ${wait} 다시 확인돼요. 그대로 [다음]을 눌러도 돼요.` };
  }

  if (code && PREVIEW_BLOCKING_CODES.has(code)) {
    return { kind: 'blocked', message: REQUEST_ERROR_MESSAGES[code] };
  }

  return { kind: 'unknown', message: '지금은 이름을 확인하지 못했어요. 그대로 [다음]을 눌러도 돼요.' };
}

// 이미 처리된 연결에 대한 조작(취소·수락·거절·해제) - 상대가 먼저 처리한 경우가 대부분이라 사실대로 안내한다
const ACTION_ERROR_MESSAGES: Record<string, string> = {
  CONNECTION_NOT_PENDING: '이미 수락되었거나 거절된 요청이에요.',
  CONNECTION_NOT_ACTIVE: '이미 연결이 해제됐어요.',
  CONNECTION_NOT_FOUND: '이미 정리된 연결이에요.',
};

export function getConnectionActionErrorMessage(error: unknown, fallback: string) {
  const code = getConnectionErrorCode(error);
  if (code && ACTION_ERROR_MESSAGES[code]) return ACTION_ERROR_MESSAGES[code];
  return getErrorBody(error)?.message || (error as Error | null)?.message || fallback;
}

// 회원 ID 입력: 영문·숫자만, 대소문자는 그대로 둔다(서버가 대소문자를 구분한다)
export const MEMBER_ID_LENGTH = 6;

export function sanitizeMemberId(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, MEMBER_ID_LENGTH);
}

export function isValidMemberId(value: string) {
  return new RegExp(`^[A-Za-z0-9]{${MEMBER_ID_LENGTH}}$`).test(value);
}

// 보호자 화면에서 어르신을 부르는 말(2026-11-24). wardRelation은 "어르신이 보호자에게 누구인지"(예: 엄마)이고
// 기존 연결·관리자 강제 연결은 비어 있다 - 비었거나 "기타"면 "어르신"으로 부른다
export const WARD_CALL_NAME_FALLBACK = '어르신';
export function wardCallName(wardRelation: string | null | undefined) {
  const value = wardRelation?.trim();
  return value && value !== '기타' ? value : WARD_CALL_NAME_FALLBACK;
}

// relation은 "보호자가 피보호자에게 누구인지" 한 방향뿐이다(예: 아들).
// 보호자 화면에서 피보호자 이름 옆에 그대로 붙이면 피보호자가 아들로 읽히므로 "김영희의 아들"로 쓴다
export function formatRelationToWard(wardName: string | null | undefined, relation: string | null | undefined) {
  if (!relation) return null;
  return wardName ? `${wardName}의 ${relation}` : relation;
}

// 대기 목록용: "아들로 요청"
export function formatRequestedAs(relation: string | null | undefined) {
  if (!relation) return '요청';
  return `${relation}${getDirectionParticle(relation)} 요청`;
}

function parseDateOnly(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const KST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

// 시각이 붙은 값은 한국 날짜로 바꿔 읽는다 - 앞 10자리를 그대로 쓰면 UTC로 온 새벽 요청이 하루 전 날짜로 보였다(QA CONN-A12).
// 시간대 표기가 없는 시각은 서버 기준(UTC)으로 보고, 날짜만 있는 값(생년월일 등)은 그대로 쓴다
export function parseKstDate(value: string | null | undefined) {
  if (!value) return null;
  if (!/T\d{2}:\d{2}/.test(value)) return parseDateOnly(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const time = new Date(hasZone ? value : `${value}Z`);
  if (Number.isNaN(time.getTime())) return parseDateOnly(value);
  return parseDateOnly(KST_DATE.format(time));
}

// "2026년 1월 12일" - 한국 날짜
export function formatKoreanDate(value: string | null | undefined) {
  const date = parseKstDate(value);
  return date ? `${date.year}년 ${date.month}월 ${date.day}일` : null;
}

export function formatMonthDay(value: string | null | undefined) {
  const date = parseKstDate(value);
  return date ? `${date.month}월 ${date.day}일` : null;
}

// 만 나이. 생년월일은 연결(ACTIVE) 뒤에만 오며, 없으면 null(화면에서 생략)
export function getAgeFromBirthDate(birthDate: string | null | undefined, today = new Date()) {
  const birth = parseDateOnly(birthDate);
  if (!birth) return null;
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const age = today.getFullYear() - birth.year - (month < birth.month || (month === birth.month && day < birth.day) ? 1 : 0);
  return age >= 0 && age < 150 ? age : null;
}
