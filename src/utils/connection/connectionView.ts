// 가족(연결) 화면 공용 표시 규칙 - 오류 문구·관계 문장·날짜·나이

import { getDirectionParticle } from '@/utils/format/korean';

interface ConnectionErrorBody {
  code?: string;
  message?: string;
  data?: { retryAfterSeconds?: number | string } | null;
}

interface ConnectionErrorLike {
  message?: string;
  response?: { data?: ConnectionErrorBody; headers?: Record<string, unknown> };
}

// 서버 오류 코드별 안내. 분기는 문구가 아니라 code로 한다(BE 문구는 바뀔 수 있다)
const REQUEST_ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: '이 회원 ID로 가입한 분이 없어요. 대소문자까지 똑같이 입력했는지 확인해 주세요.',
  INVALID_CONNECTION_ROLE: '어르신(피보호자) 계정의 회원 ID가 아니에요.',
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

// "2026년 1월 12일" - 서버 시각 문자열의 날짜 부분(KST)을 그대로 쓴다
export function formatKoreanDate(value: string | null | undefined) {
  const date = parseDateOnly(value);
  return date ? `${date.year}년 ${date.month}월 ${date.day}일` : null;
}

export function formatMonthDay(value: string | null | undefined) {
  const date = parseDateOnly(value);
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
