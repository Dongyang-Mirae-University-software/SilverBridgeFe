import { describe, expect, it } from 'vitest';

import { isCrisisAnswer, isUrgentAnswer } from './chatUrgency';

describe('isCrisisAnswer', () => {
  it('경고 없이 riskLevel high 만 온 자해 답은 위기다', () => {
    expect(isCrisisAnswer({ riskLevel: 'high' })).toBe(true);
  });

  it('경고 없이 layout.urgent 만 온 위기 뒤 턴도 위기다', () => {
    expect(isCrisisAnswer({ layout: { urgent: true } })).toBe(true);
  });

  it('의료 응급(경고 문장 있음)은 위기가 아니다 - riskLevel high 가 같이 와도', () => {
    expect(isCrisisAnswer({ emergencyWarning: ['가슴 통증이 계속되면 위험해요'] })).toBe(false);
    expect(isCrisisAnswer({ emergencyWarning: ['위험해요'], riskLevel: 'high' })).toBe(false);
  });

  it('응급이 아닌 답·빈 경고·문자열 true 는 위기가 아니다', () => {
    expect(isCrisisAnswer({})).toBe(false);
    expect(isCrisisAnswer({ emergencyWarning: [] })).toBe(false);
    expect(isCrisisAnswer({ layout: { urgent: 'true' } as never })).toBe(false);
  });

  it('위기 답은 항상 응급 판정에도 든다', () => {
    expect(isUrgentAnswer({ riskLevel: 'high' })).toBe(true);
  });
});
