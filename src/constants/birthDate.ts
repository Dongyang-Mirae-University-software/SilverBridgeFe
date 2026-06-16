export const BIRTH_DATE_START_YEAR = 1900;

export const BIRTH_DATE_PLACEHOLDERS = {
  year: 'YYYY',
  month: 'MM',
  day: 'DD',
} as const;

export const BIRTH_DATE_MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
