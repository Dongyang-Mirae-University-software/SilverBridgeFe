// 한글 단어 마지막 글자의 받침 유무로 주격 조사(이/가)를 고른다. 한글이 아니면 "가"로 둔다
export function getSubjectParticle(word: string): '이' | '가' {
  const lastChar = word.at(-1) ?? '';
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '가';

  const hasFinalConsonant = (code - 0xac00) % 28 !== 0;
  return hasFinalConsonant ? '이' : '가';
}
