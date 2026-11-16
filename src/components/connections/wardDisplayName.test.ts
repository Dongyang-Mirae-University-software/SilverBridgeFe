import { describe, expect, it } from 'vitest';

import { wardDisplayName } from './WardSelectorTabs';

describe('피보호자 표시 이름 (QA CONN-A25)', () => {
  it('빈 글자·공백·null이면 이름 없음, 이름이 있으면 그대로', () => {
    expect(wardDisplayName('')).toBe('이름 없음');
    expect(wardDisplayName('  ')).toBe('이름 없음');
    expect(wardDisplayName(null)).toBe('이름 없음');
    expect(wardDisplayName(' 김영자 ')).toBe('김영자');
  });
});
