// 챗봇 요청에 대화 이력(history)을 싣지 않는다(2026-10-29) - AI가 같은 sessionId의 서버 기록으로 맥락을 만들고
// 요청의 history는 무시한다(AI #91). 화면에 보이는 말풍선을 다시 보내는 코드가 되살아나지 않게 소스를 고정한다.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'ChatbotContent.tsx'), 'utf8');

describe('ChatbotContent 챗 요청', () => {
  it('sendChatMessage 요청 본문에 history가 없다', () => {
    const call = source.slice(source.indexOf('sendChatMessage({'), source.indexOf('});', source.indexOf('sendChatMessage({')));
    expect(call).toContain('sessionId');
    expect(call).not.toMatch(/\bhistory\b/);
  });

  it('화면 말풍선으로 history를 만들지 않는다', () => {
    expect(source).not.toMatch(/const history\s*=/);
  });
});
