import { describe, expect, it } from 'vitest';

import { parseServerTime } from './serverTime';

describe('parseServerTime - AI 서버 시각', () => {
  it('시간대 표시 없는 시각은 UTC로 읽는다 (2026-11-12 실측: 05:23 = 한국 14:23)', () => {
    expect(parseServerTime('2026-11-12T05:23:39.095242')).toBe(Date.UTC(2026, 10, 12, 5, 23, 39, 95));
  });

  it('Z·+09:00 이 붙어 있으면 그대로 읽는다', () => {
    expect(parseServerTime('2026-11-12T05:23:39Z')).toBe(Date.UTC(2026, 10, 12, 5, 23, 39));
    expect(parseServerTime('2026-11-12T14:23:39+09:00')).toBe(Date.UTC(2026, 10, 12, 5, 23, 39));
  });

  it('없거나 읽을 수 없으면 null', () => {
    expect(parseServerTime(undefined)).toBeNull();
    expect(parseServerTime(null)).toBeNull();
    expect(parseServerTime('')).toBeNull();
    expect(parseServerTime('어제')).toBeNull();
  });
});
