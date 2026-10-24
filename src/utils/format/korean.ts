// 한글 단어 마지막 글자의 받침 유무로 주격 조사(이/가)를 고른다. 한글이 아니면 "가"로 둔다
export function getSubjectParticle(word: string): '이' | '가' {
  const lastChar = word.at(-1) ?? '';
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '가';

  const hasFinalConsonant = (code - 0xac00) % 28 !== 0;
  return hasFinalConsonant ? '이' : '가';
}

function hasFinalConsonant(word: string) {
  const code = (word.at(-1) ?? '').charCodeAt(0);
  // 빈 문자열이면 NaN - 범위 비교가 모두 거짓이라 따로 막는다
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

// 이름 뒤 "님"을 붙이지 않으므로(2026-10-24) 이름에 바로 붙는 조사를 받침으로 고른다: 김영희와·박민철과 / 김영희를·박민철을
export function getAndParticle(word: string): '과' | '와' {
  return hasFinalConsonant(word) ? '과' : '와';
}

export function getObjectParticle(word: string): '을' | '를' {
  return hasFinalConsonant(word) ? '을' : '를';
}
