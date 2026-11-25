import { describe, expect, it } from 'vitest';

import {
  formatKoreanDate,
  formatMonthDay,
  formatRelationToWard,
  formatRequestedAs,
  wardCallName,
  formatRetryAfter,
  getAgeFromBirthDate,
  getConnectionActionErrorMessage,
  getConnectionRequestErrorMessage,
  getPreviewCheck,
  isValidMemberId,
  sanitizeMemberId,
} from './connectionView';

function apiError(code: string, extra: Record<string, unknown> = {}, headers: Record<string, unknown> = {}) {
  return Object.assign(new Error('서버 문구'), { response: { data: { code, message: '서버 문구', ...extra }, headers } });
}

describe('1단계 회원 ID 확인 결과 (R-2)', () => {
  it.each(['USER_NOT_FOUND', 'INVALID_CONNECTION_ROLE', 'CANNOT_CONNECT_SELF', 'CONNECTION_TARGET_NOT_ACTIVE', 'CONNECTION_ALREADY_EXISTS'])(
    '%s는 이 ID로 요청할 수 없다(blocked) - 실제 요청과 같은 문구',
    code => {
      const result = getPreviewCheck(apiError(code));
      expect(result.kind).toBe('blocked');
      expect(result.message).toBe(getConnectionRequestErrorMessage(apiError(code)));
    },
  );

  it('429는 확인만 못 한 것 - 남은 시간을 알리고 막지 않는다', () => {
    const byStatus = Object.assign(new Error('x'), {
      response: { status: 429, data: { code: 'TOO_MANY_REQUESTS', data: { retryAfterSeconds: 61 } } },
    });
    expect(getPreviewCheck(byStatus)).toEqual({
      kind: 'rateLimited',
      message: '확인을 너무 여러 번 했어요. 2분 뒤에 다시 확인돼요. 그대로 [다음]을 눌러도 돼요.',
    });
    // 상태 코드가 없어도 오류 코드로 알아본다, 남은 시간을 모르면 단정하지 않는다
    expect(getPreviewCheck(apiError('TOO_MANY_REQUESTS')).message).toContain('잠시 뒤에 다시 확인돼요');
    expect(getPreviewCheck(Object.assign(new Error('x'), { response: { status: 429 } })).kind).toBe('rateLimited');
  });

  it('반복 요청 제한·서버 오류·네트워크 오류는 확인하지 못했다고만 알린다', () => {
    for (const error of [apiError('CONNECTION_REQUEST_COOLDOWN'), apiError('INTERNAL_SERVER_ERROR'), new Error('Network Error'), null]) {
      expect(getPreviewCheck(error)).toEqual({ kind: 'unknown', message: '지금은 이름을 확인하지 못했어요. 그대로 [다음]을 눌러도 돼요.' });
    }
  });
});

describe('연결 요청 오류 문구 - code로 분기한다', () => {
  it('404·400·409는 코드별 안내', () => {
    expect(getConnectionRequestErrorMessage(apiError('USER_NOT_FOUND'))).toContain('가입한 분이 없어요');
    expect(getConnectionRequestErrorMessage(apiError('INVALID_CONNECTION_ROLE'))).toContain('어르신');
    expect(getConnectionRequestErrorMessage(apiError('CONNECTION_TARGET_NOT_ACTIVE'))).toContain('연결할 수 없는 계정');
    expect(getConnectionRequestErrorMessage(apiError('CONNECTION_ALREADY_EXISTS'))).toContain('이미 연결');
  });

  it('429 반복 요청은 남은 시간을 알려 준다(본문 우선, 없으면 Retry-After 헤더)', () => {
    expect(getConnectionRequestErrorMessage(apiError('CONNECTION_REQUEST_COOLDOWN', { data: { retryAfterSeconds: 5400 } }))).toContain(
      '1시간 30분 뒤에',
    );
    expect(getConnectionRequestErrorMessage(apiError('CONNECTION_REQUEST_COOLDOWN', {}, { 'retry-after': '120' }))).toContain('2분 뒤에');
  });

  it('남은 시간을 모르면 단정하지 않는다("내일" 아님)', () => {
    expect(getConnectionRequestErrorMessage(apiError('CONNECTION_REQUEST_COOLDOWN'))).toContain('잠시 뒤에 다시 요청할 수 있어요');
  });

  it('이미 처리된 연결 조작은 사실대로', () => {
    expect(getConnectionActionErrorMessage(apiError('CONNECTION_NOT_PENDING'), '실패')).toBe('이미 수락되었거나 거절된 요청이에요.');
    expect(getConnectionActionErrorMessage(apiError('CONNECTION_NOT_ACTIVE'), '실패')).toBe('이미 연결이 해제됐어요.');
    expect(getConnectionActionErrorMessage(new Error(''), '실패')).toBe('실패');
  });

  it('모르는 코드는 서버 문구를 그대로', () => {
    expect(getConnectionRequestErrorMessage(apiError('SOMETHING_ELSE'))).toBe('서버 문구');
  });
});

describe('표시 규칙', () => {
  it('남은 시간은 분 단위로 올린다', () => {
    expect([formatRetryAfter(30), formatRetryAfter(3600), formatRetryAfter(86399)]).toEqual(['1분', '1시간', '24시간']);
  });

  it('회원 ID는 영문·숫자 6자리, 대소문자는 바꾸지 않는다', () => {
    expect(sanitizeMemberId('aB-3x 9Zq')).toBe('aB3x9Z');
    expect([isValidMemberId('aB3x9Z'), isValidMemberId('aB3x9'), isValidMemberId('가나다라마바')]).toEqual([true, false, false]);
  });

  it('어르신 호칭은 보호자가 고른 말, 없거나 "기타"면 "어르신"', () => {
    expect(wardCallName('엄마')).toBe('엄마');
    expect(wardCallName(' 외할아버지 ')).toBe('외할아버지');
    expect([wardCallName(null), wardCallName(undefined), wardCallName(''), wardCallName('  '), wardCallName('기타')]).toEqual(
      Array(5).fill('어르신'),
    );
  });

  it('관계는 보호자 기준 문장으로 - 피보호자가 아들로 읽히지 않게', () => {
    expect(formatRelationToWard('김영희', '아들')).toBe('김영희의 아들');
    expect(formatRelationToWard('김영희', null)).toBeNull();
    expect([formatRequestedAs('아들'), formatRequestedAs('손녀'), formatRequestedAs(null)]).toEqual(['아들로 요청', '손녀로 요청', '요청']);
  });

  it('날짜와 만 나이', () => {
    expect(formatKoreanDate('2026-01-12T09:00:00+09:00')).toBe('2026년 1월 12일');
    // 한국 새벽 0시 30분에 보낸 요청이 UTC로 오면 하루 전으로 보이지 않는다(QA CONN-A12)
    expect(formatMonthDay('2026-09-29T15:30:00Z')).toBe('9월 30일');
    expect(formatMonthDay('2026-09-29T15:30:00')).toBe('9월 30일');
    expect(formatMonthDay('2026-09-30T00:30:00+09:00')).toBe('9월 30일');
    // 날짜만 있는 값은 그대로
    expect(formatKoreanDate('1946-03-02')).toBe('1946년 3월 2일');
    expect(formatKoreanDate(null)).toBeNull();
    const today = new Date(2026, 9, 24);
    expect([getAgeFromBirthDate('1948-03-15', today), getAgeFromBirthDate('1948-12-01', today), getAgeFromBirthDate(null, today)]).toEqual([
      78, 77, null,
    ]);
  });
});
