import { describe, expect, it } from 'vitest';

import { formatClipDuration, formatIncidentDate, formatIncidentTime, getPageWindow } from './anomalyFormat';

describe('formatIncidentDate', () => {
  it('월·일·요일·오전/오후 12시간제로 쓴다', () => {
    expect(formatIncidentDate('2026-10-13T22:01:30')).toBe('10월 13일 (화) 오후 10:01');
    expect(formatIncidentDate('2026-10-13T00:25:00')).toBe('10월 13일 (화) 오전 12:25');
    expect(formatIncidentDate('2026-10-12T12:05:00')).toBe('10월 12일 (월) 오후 12:05');
  });
  it('읽을 수 없는 값은 -', () => {
    expect(formatIncidentDate('not-a-date')).toBe('-');
  });
});

describe('formatIncidentTime', () => {
  it('오전/오후 12시간제 시각만', () => {
    expect(formatIncidentTime('2026-10-13T09:05:00')).toBe('오전 9:05');
    expect(formatIncidentTime('bad')).toBe('-');
  });
});

describe('formatClipDuration', () => {
  it('분:초로 쓰고 모르면 null', () => {
    expect(formatClipDuration(5200)).toBe('0:05');
    expect(formatClipDuration(65_000)).toBe('1:05');
    expect(formatClipDuration(null)).toBeNull();
    expect(formatClipDuration(0)).toBeNull();
  });
});

describe('getPageWindow', () => {
  it('페이지가 적으면 전부', () => {
    expect(getPageWindow(0, 3)).toEqual([0, 1, 2]);
  });
  it('많으면 지금 페이지 주변 5개, 양 끝에서는 밀리지 않는다', () => {
    expect(getPageWindow(0, 20)).toEqual([0, 1, 2, 3, 4]);
    expect(getPageWindow(10, 20)).toEqual([8, 9, 10, 11, 12]);
    expect(getPageWindow(19, 20)).toEqual([15, 16, 17, 18, 19]);
  });
  it('페이지가 없으면 빈 목록', () => {
    expect(getPageWindow(0, 0)).toEqual([]);
  });
});
