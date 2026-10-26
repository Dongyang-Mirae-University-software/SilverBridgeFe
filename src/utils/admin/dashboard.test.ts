import { describe, expect, it } from 'vitest';

import { ADMIN_ANOMALY_TYPE_META, formatAdminTrendDate, formatNullableCount, getReviewMetrics } from './dashboard';

describe('관리자 대시보드 집계 표시', () => {
  it('AI 연결 상태를 알 수 없는 null을 0으로 표시하지 않는다', () => {
    expect(formatNullableCount(null, '대')).toBe('확인 불가');
    expect(formatNullableCount(0, '대')).toBe('0대');
  });

  it('오탐률은 미응답을 제외한 응답 수로 계산한다', () => {
    expect(getReviewMetrics({ pending: 2, real: 1, falseAlarm: 1, conflicted: 0 }, 4)).toEqual({
      answered: 2,
      responseRate: 50,
      falseAlarmRate: 50,
    });
  });

  it('오늘 감지가 없으면 응답률과 오탐률을 0으로 계산한다', () => {
    expect(getReviewMetrics({ pending: 0, real: 0, falseAlarm: 0, conflicted: 0 }, 0)).toEqual({
      answered: 0,
      responseRate: 0,
      falseAlarmRate: 0,
    });
  });

  it('API에서 받은 유형만 레이블로 변환하고 가입 추이 날짜도 그대로 축약한다', () => {
    expect(ADMIN_ANOMALY_TYPE_META.FIRE.label).toBe('화재');
    expect(ADMIN_ANOMALY_TYPE_META.FALL.label).toBe('낙상');
    expect(formatAdminTrendDate('2026-10-26')).toBe('10.26');
  });
});
