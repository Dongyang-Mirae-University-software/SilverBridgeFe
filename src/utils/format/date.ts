import dayjs from 'dayjs';
import 'dayjs/locale/ko';

dayjs.locale('ko');

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatTime(value: string) {
  return dayjs(value).format('A h:mm');
}

export function formatDay(value: string) {
  return dayjs(value).format('DD');
}

export function formatMonth(value: string) {
  return dayjs(value).format('MM월');
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return dayjs(value).format('YYYY.MM.DD A h:mm');
}
