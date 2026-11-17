// 챗봇이 실제 전화·문자를 거는 링크를 갖지 않음을 고정한다(학생 프로젝트 - 실제 신고 금지, 2026-08-26)
// 피보호자 119 버튼은 앱 안 키패드(Emergency119Dialpad)만 연다

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe.each(['ChatbotContent.tsx', 'ChatBubble.tsx'])('%s 발신 불가 가드', file => {
  const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');

  it.each(['tel:', 'sms:', 'callto:'])('소스에 %s 가 없다', scheme => {
    expect(source.toLowerCase()).not.toContain(scheme);
  });

  // 안드로이드 intent 스킴(intent://, intent:#Intent)만 막는다 - `intent: result.intent` 같은 객체 키는 별개다
  it('소스에 intent 스킴이 없다', () => {
    expect(source.toLowerCase()).not.toMatch(/intent:(\/\/|#)/);
  });
});
