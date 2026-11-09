import { describe, expect, it } from 'vitest';

import { stripLeadEmoji } from './stripLeadEmoji';

describe('stripLeadEmoji', () => {
  it('줄마다 맨 앞 그림 문자와 뒤 공백만 뗀다', () => {
    expect(stripLeadEmoji('🏥 진료를 권해요.\n💬 걱정되시죠?')).toBe('진료를 권해요.\n걱정되시죠?');
  });

  it('변형 선택자·ZWJ 묶음·피부색도 한 덩어리로 뗀다', () => {
    expect(stripLeadEmoji('⚠️ 주의')).toBe('주의');
    expect(stripLeadEmoji('👨‍👩‍👧 가족')).toBe('가족');
    expect(stripLeadEmoji('👍🏻 좋아요')).toBe('좋아요');
  });

  it('줄 머리 국기는 떼고 키캡(번호)은 남긴다 (2026-11-09 점검 L-2)', () => {
    expect(stripLeadEmoji('🇰🇷 한국어 안내')).toBe('한국어 안내');
    expect(stripLeadEmoji('1️⃣ 물을 드세요.\n2️⃣ 쉬세요.')).toBe('1️⃣ 물을 드세요.\n2️⃣ 쉬세요.');
  });

  it('문장 중간 글자·이모지 없는 줄·숫자로 시작하는 줄은 그대로', () => {
    expect(stripLeadEmoji('오늘 ☀️ 맑아요')).toBe('오늘 ☀️ 맑아요');
    expect(stripLeadEmoji('119에 전화하세요.')).toBe('119에 전화하세요.');
    expect(stripLeadEmoji('1. 물을 드세요.')).toBe('1. 물을 드세요.');
    expect(stripLeadEmoji('')).toBe('');
  });

  it('원문 문자열은 바꾸지 않는다', () => {
    const text = '🏥 진료';
    stripLeadEmoji(text);
    expect(text).toBe('🏥 진료');
  });
});
