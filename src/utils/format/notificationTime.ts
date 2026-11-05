// 알림함 시각 - 방금 / N분 전 / 오늘이면 시각 / 어제 시각 / 그 전은 날짜·시각 (KST 기준)
const KST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
const KST_TIME = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: true });
const KST_MONTH_DAY = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });

function kstDayNumber(date: Date) {
  return Math.floor(new Date(`${KST_DATE.format(date)}T00:00:00Z`).getTime() / 86_400_000);
}

export function formatNotificationTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const dayGap = kstDayNumber(now) - kstDayNumber(date);
  const time = KST_TIME.format(date);
  if (dayGap === 0) return time;
  if (dayGap === 1) return `어제 ${time}`;
  return `${KST_MONTH_DAY.format(date)} ${time}`;
}

// 알림함 묶음 - KST 오늘이면 true
export function isNotificationToday(value: string, now = new Date()) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && kstDayNumber(date) === kstDayNumber(now);
}
