import { describe, expect, it } from 'vitest';

import { isCrisisAnswer, isUrgentAnswer } from './chatUrgency';

// AI 실제 모양(2026-11-17 확인): 자해 고정 답은 경고 박스 + riskLevel high + layout{urgent, crisis},
// 위기 뒤 해제 턴은 layout{urgent, crisis}만, 의료 응급은 경고 + layout{urgent}(crisis 없음)
const SELF_HARM = {
  emergencyWarning: ['지금 위험하다고 느끼시면 바로 119에 전화하세요. 자살예방 상담전화 109는 24시간 받습니다.'],
  riskLevel: 'high' as const,
  layout: { headline: 'h', urgent: true, crisis: true },
};

describe('isCrisisAnswer', () => {
  it('자해 고정 답은 경고가 있어도 위기다(FE #277 점검 H-1)', () => {
    expect(isCrisisAnswer(SELF_HARM)).toBe(true);
  });

  it('위기 뒤 해제 턴(layout urgent·crisis 만)도 위기다', () => {
    expect(isCrisisAnswer({ layout: { urgent: true, crisis: true } })).toBe(true);
  });

  it('의료 응급은 위기가 아니다 - 경고가 없고 high 만 와도(규칙 폴백)', () => {
    expect(isCrisisAnswer({ emergencyWarning: ['가슴 통증이 계속되면 위험해요'], layout: { urgent: true } })).toBe(false);
    expect(isCrisisAnswer({ riskLevel: 'high' })).toBe(false);
    expect(isCrisisAnswer({ layout: { urgent: true } })).toBe(false);
  });

  it('불리언 true 가 아닌 crisis·응급이 아닌 답은 위기가 아니다', () => {
    expect(isCrisisAnswer({ layout: { urgent: true, crisis: 'true' } as never })).toBe(false);
    expect(isCrisisAnswer({ layout: { crisis: true } })).toBe(false);
    expect(isCrisisAnswer({})).toBe(false);
  });

  it('위기 답은 항상 응급 판정에도 든다', () => {
    expect(isUrgentAnswer(SELF_HARM)).toBe(true);
  });
});
