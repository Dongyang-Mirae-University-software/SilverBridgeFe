import { describe, expect, it } from 'vitest';

import { DEFAULT_WARD_SETTINGS, WARD_SETTINGS_STORAGE_KEY, getWardTextVars, readStoredWardSettings, writeStoredWardSettings } from './wardSettings';

describe('getWardTextVars', () => {
  it('보통·꺼짐은 1배·0', () => {
    expect(getWardTextVars({ fontSize: 17, highContrast: false })).toEqual({
      '--ward-font-scale': '1',
      '--ward-weight-boost': '0',
    });
  });

  it('크게 1.24배·아주 크게 1.47배, 진한 글자는 +200', () => {
    expect(getWardTextVars({ fontSize: 21, highContrast: true })).toEqual({
      '--ward-font-scale': '1.235',
      '--ward-weight-boost': '200',
    });
    expect(getWardTextVars({ fontSize: 25, highContrast: false })['--ward-font-scale']).toBe('1.471');
  });

  it('범위를 벗어난 저장값은 허용 범위로 자른다', () => {
    expect(getWardTextVars({ fontSize: 99, highContrast: false })['--ward-font-scale']).toBe('1.647');
    expect(getWardTextVars({ fontSize: Number.NaN, highContrast: false })['--ward-font-scale']).toBe('1');
  });
});

describe('저장된 피보호자 설정 읽기 (QA CONN-A27)', () => {
  const memory = (raw: string | null) => {
    const values = new Map<string, string>(raw === null ? [] : [[WARD_SETTINGS_STORAGE_KEY, raw]]);
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      values,
    };
  };

  it('깨진 JSON이면 기본 설정을 쓰고 깨진 값을 지운다', () => {
    const storage = memory('{oops');
    expect(readStoredWardSettings(storage)).toEqual(DEFAULT_WARD_SETTINGS);
    expect(storage.values.has(WARD_SETTINGS_STORAGE_KEY)).toBe(false);
  });

  it('null·숫자처럼 객체가 아니면 기본 설정을 쓴다', () => {
    expect(readStoredWardSettings(memory('null'))).toEqual(DEFAULT_WARD_SETTINGS);
    expect(readStoredWardSettings(memory('3'))).toEqual(DEFAULT_WARD_SETTINGS);
  });

  it('읽기·쓰기가 막혀도 예외 없이 기본 설정으로 연다', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    expect(readStoredWardSettings(blocked)).toEqual(DEFAULT_WARD_SETTINGS);
    expect(() => writeStoredWardSettings(blocked, DEFAULT_WARD_SETTINGS)).not.toThrow();
  });

  it('올바른 값은 그대로 읽는다', () => {
    expect(readStoredWardSettings(memory(JSON.stringify({ ...DEFAULT_WARD_SETTINGS, highContrast: true }))).highContrast).toBe(true);
  });
});
