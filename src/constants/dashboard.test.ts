import { describe, expect, it } from 'vitest';
import { GUARDIAN_NAV, wardNavItems } from './dashboard';

describe('wardNavItems - 안부 말벗 메뉴는 테스트 계정만', () => {
  it('일반 피보호자 사이드바에는 안부 말벗이 없다', () => {
    expect(wardNavItems(false).map(item => item.href)).not.toContain('/ward/companion');
  });

  it('테스트 계정은 홈 다음에 안부 말벗', () => {
    expect(wardNavItems(true).slice(0, 2).map(item => item.href)).toEqual(['/ward', '/ward/companion']);
  });

  it('보호자 메뉴는 v13 시안의 4개에 AI 기분 체크를 더한 5개', () => {
    expect(GUARDIAN_NAV.map(item => item.label)).toEqual(['홈', 'AI 기분 체크', '공지사항', '문의하기', '환경설정']);
  });
});
