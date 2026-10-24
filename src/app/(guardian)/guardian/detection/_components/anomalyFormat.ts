import dayjs from 'dayjs';

const DAY_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// 시각만 - "오후 10:01". 서버 시각(KST)을 그대로 읽는다
export function formatIncidentTime(value: string) {
  const date = dayjs(value);
  if (!date.isValid()) return '-';
  const hour = date.hour();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour < 12 ? '오전' : '오후'} ${hour12}:${date.format('mm')}`;
}

// 이력 줄·영상 화면의 날짜 - "10월 13일 (화) 오후 10:01"
export function formatIncidentDate(value: string) {
  const date = dayjs(value);
  if (!date.isValid()) return '-';
  return `${date.month() + 1}월 ${date.date()}일 (${DAY_OF_WEEK[date.day()]}) ${formatIncidentTime(value)}`;
}

// 클립 길이 "0:05". 모르면 null(배지를 그리지 않는다)
export function formatClipDuration(durationMs: number | null | undefined) {
  if (!durationMs) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

// 번호 페이지 이동에 보일 페이지(0부터). 페이지가 많으면 지금 페이지 주변 최대 size개만
export function getPageWindow(page: number, totalPages: number, size = 5) {
  if (totalPages <= 0) return [];
  const count = Math.min(size, totalPages);
  const start = Math.min(Math.max(page - Math.floor(count / 2), 0), totalPages - count);
  return Array.from({ length: count }, (_, index) => start + index);
}
