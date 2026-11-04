/**
 * 피보호자 챗봇 말풍선 - 문장이 끝나는 곳에서 줄을 바꿔 보여 준다(2026-11-04).
 * 표시할 때만 쓰고 원문(message.content 등)은 바꾸지 않는다.
 *
 * 끊는 곳: 한글 음절 바로 뒤의 . ? ! (연속 "?!"·"..." 포함, 뒤 닫는 따옴표 허용) + 공백 → 그 공백을 줄바꿈 하나로.
 * 끊지 않는 곳:
 *  - 앞 글자가 숫자·영문·기호 (1.5 / "1. " 번호 / 2026.11.04 / 3:00. / Dr. Kim / "요)." 처럼 괄호를 닫은 뒤)
 *  - 괄호 ( ) [ ] 안
 *  - 뒤 공백에 이미 줄바꿈이 있을 때(빈 줄을 새로 만들지 않는다)
 *  - 다음 글자가 이모지일 때(이모지만 한 줄에 남지 않게)
 *  - 문자열 끝
 */
const HANGUL_SYLLABLE = /[가-힣]/;
const SENTENCE_END = /[.?!]/;
const CLOSING_QUOTE = /["'”’]/;
const INLINE_SPACE = /[ \t ]/;
const PICTOGRAPHIC = /^\p{Extended_Pictographic}/u;

export function breakSentences(text: string): string {
  if (!text) return text;
  let out = '';
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if ((ch === ')' || ch === ']') && depth > 0) depth -= 1;

    if (!SENTENCE_END.test(ch) || depth > 0 || i === 0 || !HANGUL_SYLLABLE.test(text[i - 1])) {
      out += ch;
      i += 1;
      continue;
    }

    // 문장 끝 기호 묶음 + 닫는 따옴표
    let end = i;
    while (end < text.length && SENTENCE_END.test(text[end])) end += 1;
    while (end < text.length && CLOSING_QUOTE.test(text[end])) end += 1;
    const mark = text.slice(i, end);

    // 뒤 공백(줄바꿈 제외)
    let next = end;
    while (next < text.length && INLINE_SPACE.test(text[next])) next += 1;

    const hasSpace = next > end;
    const following = text.slice(next);
    const shouldBreak =
      hasSpace &&
      following.length > 0 &&
      following[0] !== '\n' &&
      following[0] !== '\r' &&
      !PICTOGRAPHIC.test(following);

    out += shouldBreak ? `${mark}\n` : text.slice(i, next);
    i = next;
  }
  return out;
}
