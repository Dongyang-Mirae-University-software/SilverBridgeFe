// 말벗 질문·응답을 문장마다 한 줄로 보이게 나눈다 - 문장 끝 '?'·'.'·'!'(이어진 것 포함) 뒤 공백에서만 자른다.
// "3.5"·"오전 9:00." 처럼 뒤에 공백이 없는 점은 자르지 않는다. 빈 값은 빈 배열.
export function splitSentences(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[?.!？。！]+)\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}
