/**
 * AI 서버 시각(ms). AI 는 시각을 시간대 표시 없는 UTC("2026-11-12T05:23:39.095242" = 한국 14:23)로 주는 곳이 있다
 * (상담 기록 - AI #267에서 Z 추가, 게임 진행 기록 등). 그대로 Date·dayjs 에 넣으면 브라우저 시간대(한국)로 읽혀
 * 9시간 이르게 보인다(2026-11-12 실측). 표시가 없으면 UTC로 읽고, Z·+09:00 등이 있으면 그대로 읽는다.
 */
export function parseServerTime(value?: string | null): number | null {
  if (!value) return null;
  const text = value.trim();
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const parsed = Date.parse(hasZone || !text.includes('T') ? text : `${text}Z`);
  return Number.isNaN(parsed) ? null : parsed;
}
