// 119 키패드가 실제 전화를 걸 수 있는 경로를 갖지 않음을 고정한다(학생 프로젝트 - 실제 신고 금지, 2026-08-26)
// 휴대폰 다이얼러는 웹에서 통화 버튼을 막을 수 없으므로 전화·문자·앱 호출 스킴과 페이지 이동 자체를 쓰지 않는다

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./Emergency119Dialpad.tsx', import.meta.url)), 'utf8');

describe('Emergency119Dialpad 발신 불가 가드', () => {
  it.each(['tel:', 'sms:', 'intent:', 'callto:', 'facetime'])('소스에 %s 가 없다', scheme => {
    expect(source.toLowerCase()).not.toContain(scheme);
  });

  it('페이지 이동·새 창·링크를 쓰지 않는다', () => {
    expect(source).not.toMatch(/window\.(location|open)|location\.(href|assign|replace)|href=|<a[\s>]|<Link|useRouter/);
  });
});
