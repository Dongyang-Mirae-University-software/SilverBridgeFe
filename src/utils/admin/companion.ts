import { AdminCompanionContinuingWard, AdminCompanionMoodDistribution } from '@/service/interface/admin/aiStats';

export const COMPANION_MOOD_ROWS: Array<{ key: keyof Omit<AdminCompanionMoodDistribution, 'wardCount' | 'unknown'>; label: string; tone: string }> = [
  { key: 'joy', label: '기쁨', tone: 'safe' },
  { key: 'calm', label: '평온', tone: 'accent' },
  { key: 'worry', label: '걱정', tone: 'sun' },
  { key: 'depressed', label: '우울', tone: 'mute' },
];

export const CONTINUING_MOOD_LABEL: Record<AdminCompanionContinuingWard['mood'], string> = { WORRY: '걱정', DEPRESSED: '우울' };

function kstDayNumber(time: number) {
  return Math.floor((time + 9 * 3_600_000) / 86_400_000);
}

// "마지막 대화 ○○" - 오늘·어제는 시각까지, 그 전은 며칠 전. 한 번도 없으면 "대화 기록 없음"
export function formatLastDialogue(value: string | null, now = Date.now()) {
  if (!value) return '대화 기록 없음';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '대화 기록 없음';
  const days = kstDayNumber(now) - kstDayNumber(time);
  if (days >= 2) return `마지막 대화 ${days}일 전`;
  const clock = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(time);
  return `마지막 대화 ${days <= 0 ? '오늘' : '어제'} ${clock}`;
}
