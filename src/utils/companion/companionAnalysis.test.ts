import { describe, expect, it } from 'vitest';

import { formatResultAnalysis, formatTurnAnalysis } from './companionAnalysis';

describe('테스트 판정 결과 문장', () => {
  it('턴 판정을 한 줄로 옮긴다', () => {
    expect(formatTurnAnalysis(2, {
      turnLabel: '기쁨',
      turnSource: 'FACE',
      face: { usable: true, label: '기쁨', confidence: 0.91, frameCount: 4, totalFrames: 5, facesFound: 4 },
      riskFlag: true,
      signals: { sleep: '나쁨', riskFlag: true, pain: null, lonely: false },
    })).toBe('2번째 대답 · 턴 기분: 기쁨 · 근거: 표정 · 표정: 기쁨(사진 5장 중 얼굴 4, 확신 91%) · 위험: 있음 · 신호: sleep=나쁨, riskFlag');
  });

  it('사진이 없거나 얼굴을 못 쓰면 그대로 알린다, 모르는 근거 코드는 받은 값 그대로', () => {
    expect(formatTurnAnalysis(1, { turnLabel: null, turnSource: 'NO_RESPONSE', face: null, riskFlag: false }))
      .toBe('1번째 대답 · 턴 기분: 없음 · 근거: 무응답 · 표정: 사진 없음 · 위험: 없음');
    expect(formatTurnAnalysis(1, { turnLabel: 'CALM', turnSource: 'NEW_SOURCE', face: { usable: false, totalFrames: 3, facesFound: 0 }, riskFlag: false }))
      .toBe('1번째 대답 · 턴 기분: 평온 · 근거: NEW_SOURCE · 표정: 판단 못 함(사진 3장 중 얼굴 0) · 위험: 없음');
  });

  it('대화 판정 - 기분 null은 판단 불가', () => {
    expect(formatResultAnalysis({ mood: null, turnCount: 3, riskFlag: false, alertLevel: 'INFO' }))
      .toBe('대화 마침 · 대화 기분: 판단 불가 · 턴 수: 3 · 위험: 없음 · 알림 단계: 안내');
  });
});
