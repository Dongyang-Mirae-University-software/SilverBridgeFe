import { describe, expect, it } from 'vitest';

import { getWardTextVars } from './wardSettings';

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
