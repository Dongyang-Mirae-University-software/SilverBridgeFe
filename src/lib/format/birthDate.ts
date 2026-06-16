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

export function getBirthDateYears(startYear = 1900) {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - startYear + 1 }, (_, index) => String(currentYear - index));
}

export function getBirthDateMonths() {
  return Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
}

export function getBirthDateDays(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!numericYear || !numericMonth) return [];

  const lastDay = new Date(numericYear, numericMonth, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => String(index + 1).padStart(2, '0'));
}
