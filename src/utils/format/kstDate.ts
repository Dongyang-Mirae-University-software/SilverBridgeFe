// 관리자 화면 공용 날짜 표기 - 한국 시간 기준 "2026-11-10" / "2026-11-10 23:10"(24시간제)
const KST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function kstParts(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(KST_PARTS.formatToParts(date).map(part => [part.type, part.value]));
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

export function formatKstDate(value: string | null | undefined) {
  const parts = kstParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '-';
}

export function formatKstDateTime(value: string | null | undefined) {
  const parts = kstParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` : '-';
}
