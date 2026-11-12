import { describe, expect, it } from 'vitest';

import { formatResultAnalysis, formatTurnAnalysis, summarizeResultAnalysis, summarizeTurnAnalysis } from './companionAnalysis';

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

  it('말로 본 기분(textMood) - 턴 라벨과 확신을 표정 앞에 넣는다', () => {
    expect(formatTurnAnalysis(1, {
      turnLabel: '슬픔', turnSource: 'TEXT_FACE', face: null, riskFlag: false,
      textMood: { label: 'WORRY', turnLabel: '슬픔', confidence: 0.8231, usable: true, reason: null },
    })).toBe('1번째 대답 · 턴 기분: 슬픔 · 근거: 말+표정 · 말로 본 기분: 슬픔(확신 82%) · 표정: 사진 없음 · 위험: 없음');
    expect(formatTurnAnalysis(1, {
      turnLabel: '평온', turnSource: 'TEXT', face: null, riskFlag: false,
      textMood: { label: 'CALM', turnLabel: null, confidence: 7, usable: true },
    })).toBe('1번째 대답 · 턴 기분: 평온 · 근거: 말 · 말로 본 기분: 평온 · 표정: 사진 없음 · 위험: 없음');
  });

  it('말로 본 기분 - usable=false면 판단 안 함(reason, 없으면 모델 라벨)', () => {
    const base = { turnLabel: '기쁨', turnSource: 'FACE', face: null, riskFlag: false };
    expect(formatTurnAnalysis(1, { ...base, textMood: { label: null, turnLabel: null, confidence: null, usable: false, reason: 'SHORT' } }))
      .toContain('말로 본 기분: 판단 안 함(SHORT) · 표정:');
    expect(formatTurnAnalysis(1, { ...base, textMood: { label: '중립', turnLabel: null, confidence: 0.4, usable: false, reason: null } }))
      .toContain('말로 본 기분: 판단 안 함(라벨 중립) · 표정:');
  });

  it('말로 본 기분 - null이면 칸을 넣지 않는다', () => {
    expect(formatTurnAnalysis(1, { turnLabel: null, turnSource: 'NO_RESPONSE', face: null, riskFlag: false, textMood: null }))
      .toBe('1번째 대답 · 턴 기분: 없음 · 근거: 무응답 · 표정: 사진 없음 · 위험: 없음');
  });

  it('사진 0장(글로 대답한 턴)이면 확신 0% 없이 사진 없음', () => {
    expect(formatTurnAnalysis(1, {
      turnLabel: '기쁨', turnSource: 'TEXT', riskFlag: false,
      face: { usable: false, label: null, confidence: 0, frameCount: 0, totalFrames: 0, facesFound: 0 },
    })).toBe('1번째 대답 · 턴 기분: 기쁨 · 근거: 말 · 표정: 사진 없음 · 위험: 없음');
    expect(formatTurnAnalysis(1, { turnLabel: '기쁨', turnSource: 'TEXT', riskFlag: false, face: { usable: false, frameCount: 0 } }))
      .toContain('표정: 사진 없음');
  });

  it('대화 판정 - 기분 null은 판단 불가', () => {
    expect(formatResultAnalysis({ mood: null, turnCount: 3, riskFlag: false, alertLevel: 'INFO' }))
      .toBe('대화 마침 · 대화 기분: 판단 불가 · 턴 수: 3 · 위험: 없음 · 알림 단계: 안내');
  });
});

describe('summarizeTurnAnalysis·summarizeResultAnalysis (판정 칸)', () => {
  it('턴 판정을 기분 글자·말·표정·위험 칸으로 나누고, 자세히에는 기존 한 줄 문구를 둔다', () => {
    const s = summarizeTurnAnalysis(2, {
      turnLabel: '우울', turnSource: 'TEXT_FACE', riskFlag: false, signals: null,
      face: { usable: true, label: '평온', confidence: 0.8, totalFrames: 3, facesFound: 3 },
      textMood: { label: 'DEPRESSED', turnLabel: '우울', confidence: 0.9, usable: true, reason: null },
    });
    expect(s).toMatchObject({ title: '2번째', rowLabel: '2번', mood: '우울', tone: 'depressed', line: '말 우울 · 표정 평온' });
    expect(s.cells).toEqual([
      { label: '말', value: '우울', tone: 'depressed' },
      { label: '표정', value: '평온', tone: 'calm' },
      { label: '위험', value: '없음', tone: 'safe' },
    ]);
    expect(s.detail).toContain('말로 본 기분: 우울(확신 90%)');
  });

  it('값이 없으면 판단 안 함·사진 없음·없음으로 둔다(만들어 내지 않는다)', () => {
    const s = summarizeTurnAnalysis(1, { turnLabel: null, turnSource: 'NO_RESPONSE', face: null, riskFlag: true, signals: null });
    expect(s.mood).toBe('판단 안 함');
    expect(s.tone).toBe('unknown');
    expect(s.cells.map(c => c.value)).toEqual(['없음', '사진 없음', '있음']);
    expect(s.cells[2].tone).toBe('danger');
  });

  it('대화 마침은 턴 수·위험·알림 칸', () => {
    const s = summarizeResultAnalysis({ mood: 'WORRY', turnCount: 8, riskFlag: true, alertLevel: 'URGENT' });
    expect(s).toMatchObject({ title: '대화 마침', rowLabel: '마침', mood: '걱정', tone: 'worry', line: '턴 8 · 위험 있음' });
    expect(s.cells.map(c => `${c.label}:${c.value}`)).toEqual(['턴 수:8', '위험:있음', '알림:긴급']);
  });
});
