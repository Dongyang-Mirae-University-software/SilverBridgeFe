/**
 * 줄 머리 이모지(AI가 줄마다 붙이는 장식)를 화면에서 뗀다(2026-11-09). 표시할 때만 쓰고 원문은 바꾸지 않는다.
 *
 * 각 줄 맨 앞의 그림 문자 묶음(변형 선택자 FE0F·ZWJ 이음·피부색 포함)·국기(지역 표시 문자 두 개)와 뒤 공백만 지운다.
 * 키캡(1️⃣ 등)은 번호 역할이라 남긴다(2026-11-09 점검 L-2 결정).
 * 문장 중간 글자는 건드리지 않는다. 판단(응급 여부 등)에 쓰지 않는다 - 보이는 모양만 바꾼다.
 */
const LEAD_EMOJI =
  /^([ \t]*)(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D|\p{Emoji_Modifier})*|\p{Regional_Indicator}{2})+[ \t]*/gmu;

export function stripLeadEmoji(text: string): string {
  if (!text) return text;
  return text.replace(LEAD_EMOJI, '$1');
}
