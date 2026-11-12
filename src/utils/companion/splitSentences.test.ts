import { describe, expect, it } from 'vitest';
import { splitSentences } from './splitSentences';

describe('splitSentences', () => {
  it('물음표·마침표 뒤에서 나눈다', () => {
    expect(splitSentences('그러셨군요. 오늘 점심은 드셨어요?')).toEqual(['그러셨군요.', '오늘 점심은 드셨어요?']);
  });

  it('문장 하나면 그대로 둔다', () => {
    expect(splitSentences('오후는 어떻게 보내고 계세요?')).toEqual(['오후는 어떻게 보내고 계세요?']);
  });

  it('뒤에 공백이 없는 점(숫자·줄임)은 자르지 않고, 이어진 부호는 한 번만 자른다', () => {
    expect(splitSentences('체온이 36.5도예요... 괜찮으세요?! 다행이에요.')).toEqual(['체온이 36.5도예요...', '괜찮으세요?!', '다행이에요.']);
  });

  it('줄바꿈·여러 공백도 나눔 자리로 보고, 빈 값은 빈 배열', () => {
    expect(splitSentences('좋아요.\n  또 이야기해요.')).toEqual(['좋아요.', '또 이야기해요.']);
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences(null)).toEqual([]);
  });
});
