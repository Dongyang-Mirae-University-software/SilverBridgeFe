import { BIRTH_DATE_MONTHS, BIRTH_DATE_START_YEAR } from '@/constants/birthDate';

export type BirthDateParts = {
  year: string;
  month: string;
  day: string;
};

export function parseBirthDate(value?: string | null): BirthDateParts {
  if (!value) return { year: '', month: '', day: '' };

  const [year = '', month = '', day = ''] = value.trim().split('-');
  return {
    year,
    month,
    day,
  };
}

export function composeBirthDate(parts: BirthDateParts) {
  const year = parts.year.trim();
  const month = parts.month.trim();
  const day = parts.day.trim();

  if (!year || !month || !day) return '';
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function getBirthDateYears(startYear = BIRTH_DATE_START_YEAR) {
  const normalizedStartYear = Math.max(startYear, BIRTH_DATE_START_YEAR);
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - normalizedStartYear + 1 }, (_, index) => String(currentYear - index));
}

export function getBirthDateMonths() {
  return BIRTH_DATE_MONTHS;
}

export function getBirthDateDays(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!numericYear || !numericMonth) return [];

  const lastDay = new Date(numericYear, numericMonth, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => String(index + 1).padStart(2, '0'));
}

const KST_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
export const MIN_SIGNUP_AGE = 14;
export const MAX_SIGNUP_AGE = 120;

// 가입 생년월일 - 서버와 같은 규칙(한국 날짜 오늘보다 앞선 날, 만 14세 이상 120세 이하).
// 예전에는 화면이 비었는지만 봐서 마지막 가입 요청에서야 400이 났다(QA AUTH-A05). 문제없으면 null
export function getBirthDateError(value: string, now = new Date()) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value.trim() ? '생년월일을 다시 골라 주세요.' : null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '생년월일을 다시 골라 주세요.';

  const today = KST_TODAY.format(now);
  if (value >= today) return '오늘보다 앞선 날짜를 골라 주세요.';
  const [ty, tm, td] = today.split('-').map(Number);
  const age = ty - year - (tm < month || (tm === month && td < day) ? 1 : 0);
  if (age < MIN_SIGNUP_AGE) return `만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있어요.`;
  if (age > MAX_SIGNUP_AGE) return `만 ${MAX_SIGNUP_AGE}세 이하만 가입할 수 있어요.`;
  return null;
}
