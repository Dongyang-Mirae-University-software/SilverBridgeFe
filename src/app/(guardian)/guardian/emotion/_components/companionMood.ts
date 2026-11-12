import type { MoodFaceKind } from '@/components/MoodFace';
import type { CompanionMood, CompanionSlotStatus } from '@/service/interface/guardian/companion';

export const UNKNOWN_MOOD = '확인할 수 없어요';

export const MOOD_META: Record<CompanionMood, { label: string; face: MoodFaceKind; tone: string }> = {
  JOY: { label: '기쁨', face: 'happy', tone: 'joy' },
  CALM: { label: '평온', face: 'calm', tone: 'calm' },
  WORRY: { label: '걱정', face: 'worried', tone: 'worry' },
  DEPRESSED: { label: '우울', face: 'sad', tone: 'depressed' },
};

export const STATUS_LABEL: Record<CompanionSlotStatus, string> = {
  DONE: '마침',
  UPCOMING: '예정',
  AVAILABLE: '지금 대화 가능',
  IN_PROGRESS: '대화 중',
  MISSED: '지나감',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// "2026-11-11" → { month: 11, day: 11, weekday: '수' } (KST 날짜 문자열 그대로, 시간대 변환 없음)
export function parseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  return { month: m, day: d, weekday };
}

export function formatDateLabel(date: string) {
  const { month, day, weekday } = parseDate(date);
  return `${month}월 ${day}일 ${weekday}요일`;
}

export function companionSessionHref(wardId: string, sessionId: number) {
  return `/guardian/emotion/sessions/${sessionId}?wardId=${encodeURIComponent(wardId)}`;
}
