import classNames from 'classnames/bind';

import styles from './BirthDateSelects.module.css';
import { composeBirthDate, getBirthDateDays, getBirthDateMonths, getBirthDateYears, parseBirthDate } from '@/lib/format/birthDate';
import { BIRTH_DATE_PLACEHOLDERS } from '@/constants/birthDate';

const cx = classNames.bind(styles);

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function BirthDateSelects({ value, onChange, className }: Props) {
  const { year, month, day } = parseBirthDate(value);
  const days = getBirthDateDays(year, month);
  const normalizedDay = day && days.includes(day) ? day : '';

  return (
    <div className={cx('birthDateSelects', className)}>
      <select
        value={year}
        onChange={event => {
          const nextYear = event.target.value;
          const nextDays = getBirthDateDays(nextYear, month);
          onChange(composeBirthDate({ year: nextYear, month, day: normalizedDay && nextDays.includes(normalizedDay) ? normalizedDay : '' }));
        }}
      >
        <option value="">{BIRTH_DATE_PLACEHOLDERS.year}</option>
        {getBirthDateYears().map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={event => {
          const nextMonth = event.target.value;
          const nextDays = getBirthDateDays(year, nextMonth);
          onChange(composeBirthDate({ year, month: nextMonth, day: normalizedDay && nextDays.includes(normalizedDay) ? normalizedDay : '' }));
        }}
      >
        <option value="">{BIRTH_DATE_PLACEHOLDERS.month}</option>
        {getBirthDateMonths().map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select value={normalizedDay} onChange={event => onChange(composeBirthDate({ year, month, day: event.target.value }))}>
        <option value="">{BIRTH_DATE_PLACEHOLDERS.day}</option>
        {days.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
