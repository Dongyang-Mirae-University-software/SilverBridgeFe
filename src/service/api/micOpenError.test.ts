import { describe, expect, it } from 'vitest';

import { STT_MESSAGES, micOpenErrorMessage } from './chatSttPolicy';

// 마이크 열기 실패를 오류 이름으로 나눈다(2026-11-23 FE #335 점검 V-1)
describe('마이크 열기 실패 안내', () => {
  it.each([
    ['NotAllowedError', STT_MESSAGES.permission],
    ['SecurityError', STT_MESSAGES.permission],
    ['NotFoundError', STT_MESSAGES.micNotFound],
    ['OverconstrainedError', STT_MESSAGES.micNotFound],
    ['NotReadableError', STT_MESSAGES.micInUse],
    // 옛 Chrome·웹뷰 이름(2026-11-24 #337 점검 K-1) / 원인을 모르는 장치 시작 실패(K-2)
    ['DevicesNotFoundError', STT_MESSAGES.micNotFound],
    ['TrackStartError', STT_MESSAGES.micInUse],
    ['PermissionDeniedError', STT_MESSAGES.permission],
    ['AbortError', STT_MESSAGES.micOpenFailed],
  ])('%s → %s', (name, message) => {
    expect(micOpenErrorMessage(new DOMException('x', name))).toBe(message);
  });

  it('이름을 모르는 오류는 권한 안내(전과 같음)', () => {
    expect(micOpenErrorMessage(new Error('x'))).toBe(STT_MESSAGES.permission);
    expect(micOpenErrorMessage(undefined)).toBe(STT_MESSAGES.permission);
    expect(micOpenErrorMessage('NotFoundError')).toBe(STT_MESSAGES.permission);
  });
});
