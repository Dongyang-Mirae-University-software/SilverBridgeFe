import { useEffect, useRef, useState } from 'react';
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
  const [parts, setParts] = useState(() => parseBirthDate(value));
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (value) {
      setParts(parseBirthDate(value));
      hasInteracted.current = false;
      return;
    }

    if (!hasInteracted.current) {
      setParts({ year: '', month: '', day: '' });
    }
  }, [value]);

  const { year, month, day } = parts;
  const days = getBirthDateDays(year, month);
  const normalizedDay = day && days.includes(day) ? day : '';

  const updateParts = (nextParts: { year: string; month: string; day: string }) => {
    hasInteracted.current = true;
    setParts(nextParts);

    const nextValue = composeBirthDate(nextParts);
    onChange(nextValue);
  };

  return (
    <div className={cx('birthDateSelects', className)}>
      <select
        value={year}
        onChange={event => {
          const nextYear = event.target.value;
          const nextDays = getBirthDateDays(nextYear, month);
          updateParts({ year: nextYear, month, day: normalizedDay && nextDays.includes(normalizedDay) ? normalizedDay : '' });
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
          updateParts({ year, month: nextMonth, day: normalizedDay && nextDays.includes(normalizedDay) ? normalizedDay : '' });
        }}
      >
        <option value="">{BIRTH_DATE_PLACEHOLDERS.month}</option>
        {getBirthDateMonths().map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select value={normalizedDay} onChange={event => updateParts({ year, month, day: event.target.value })}>
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
