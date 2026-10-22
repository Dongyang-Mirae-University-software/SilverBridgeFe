import { describe, expect, it } from 'vitest';

import { formatDoseAmount } from './medication';

describe('formatDoseAmount (2026-10-22 점검 M-3)', () => {
  it('BE 알림 문구와 같게 - 0.5는 "반 알", 1.5는 "1정 반", 정수는 "N정"', () => {
    expect(formatDoseAmount(0.5)).toBe('반 알');
    expect(formatDoseAmount(1)).toBe('1정');
    expect(formatDoseAmount(1.5)).toBe('1정 반');
    expect(formatDoseAmount(2)).toBe('2정');
    expect(formatDoseAmount(99)).toBe('99정');
  });
});
