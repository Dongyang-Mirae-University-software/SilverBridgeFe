import { describe, expect, it } from 'vitest';

import {
  canRecreateSession,
  getRecreateBackoffMs,
  isSessionNotFound,
  isSurveillanceLost,
  isUploadUnstable,
  SURVEILLANCE_LOST_MS,
  UNSTABLE_MS,
} from './streamRecovery';

const err = (status: number, errorCode?: string) => ({ response: { status, data: errorCode ? { errorCode } : {} } });

describe('isSessionNotFound', () => {
  it('404 + STREAM_SESSION_NOT_FOUND 는 true', () => {
    expect(isSessionNotFound(err(404, 'STREAM_SESSION_NOT_FOUND'))).toBe(true);
  });
  it('errorCode 가 없는 404(앞단 프록시가 HTML 로 바꾼 경우 포함)도 true', () => {
    expect(isSessionNotFound(err(404))).toBe(true);
    expect(isSessionNotFound({ response: { status: 404, data: '<!doctype html><title>404</title>' } })).toBe(true);
    expect(isSessionNotFound({ response: { status: 404, data: null } })).toBe(true);
  });
  it('다른 errorCode 의 404·다른 상태·네트워크 오류는 false', () => {
    expect(isSessionNotFound(err(404, 'HTTP_ERROR'))).toBe(false);
    expect(isSessionNotFound(err(500, 'STREAM_SESSION_NOT_FOUND'))).toBe(false);
    expect(isSessionNotFound(err(429))).toBe(false);
    expect(isSessionNotFound(new Error('Network Error'))).toBe(false);
    expect(isSessionNotFound(undefined)).toBe(false);
  });
});

describe('getRecreateBackoffMs', () => {
  it('2 → 4 → 8 → 30초에서 멈춘다', () => {
    expect([0, 1, 2, 3, 4, 10].map(getRecreateBackoffMs)).toEqual([2000, 4000, 8000, 30000, 30000, 30000]);
  });
});

describe('canRecreateSession', () => {
  const base = { now: 1000, nextAllowedAt: 0, recreating: false, isStillStreaming: true };
  it('처음엔 바로 허용', () => expect(canRecreateSession(base)).toBe(true));
  it('진행 중이면 중복 호출하지 않는다', () => expect(canRecreateSession({ ...base, recreating: true })).toBe(false));
  it('끈 뒤에는 재생성하지 않는다', () => expect(canRecreateSession({ ...base, isStillStreaming: false })).toBe(false));
  it('대기 시간 전에는 하지 않는다', () => expect(canRecreateSession({ ...base, nextAllowedAt: 2000 })).toBe(false));
});

describe('isUploadUnstable', () => {
  it('10초 이상 실패가 이어질 때만 true', () => {
    expect(isUploadUnstable(null, 99999)).toBe(false);
    expect(isUploadUnstable(1000, 1000 + UNSTABLE_MS - 1)).toBe(false);
    expect(isUploadUnstable(1000, 1000 + UNSTABLE_MS)).toBe(true);
  });
});

describe('isSurveillanceLost', () => {
  it('30초 이상 실패가 이어질 때만 true', () => {
    expect(isSurveillanceLost(null, 99999)).toBe(false);
    expect(isSurveillanceLost(1000, 1000 + SURVEILLANCE_LOST_MS - 1)).toBe(false);
    expect(isSurveillanceLost(1000, 1000 + SURVEILLANCE_LOST_MS)).toBe(true);
  });
});
