import { useState } from 'react';
import classNames from 'classnames/bind';

import styles from './BirthDateSelects.module.css';
import { composeBirthDate, getBirthDateDays, getBirthDateMonths, getBirthDateYears, parseBirthDate } from '@/utils/format/birthDate';
import { BIRTH_DATE_PLACEHOLDERS } from '@/constants/birthDate';

const cx = classNames.bind(styles);

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function BirthDateSelects({ value, onChange, className }: Props) {
  const [parts, setParts] = useState(() => parseBirthDate(value));
  const [hasInteracted, setHasInteracted] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // 바깥 값이 바뀌면 렌더 중에 칸을 맞춘다(effect 안 setState는 렌더를 한 번 더 일으킨다)
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      setParts(parseBirthDate(value));
      setHasInteracted(false);
    } else if (!hasInteracted) {
      setParts({ year: '', month: '', day: '' });
    }
  }

  const { year, month, day } = parts;
  const days = getBirthDateDays(year, month);
  const normalizedDay = day && days.includes(day) ? day : '';

  const updateParts = (nextParts: { year: string; month: string; day: string }) => {
    setHasInteracted(true);
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
        <option value="" disabled>
          {BIRTH_DATE_PLACEHOLDERS.year}
        </option>
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
        <option value="" disabled>
          {BIRTH_DATE_PLACEHOLDERS.month}
        </option>
        {getBirthDateMonths().map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select
        value={normalizedDay}
        onChange={event => {
          updateParts({ year, month, day: event.target.value });
        }}
      >
        <option value="" disabled>
          {BIRTH_DATE_PLACEHOLDERS.day}
        </option>
        {days.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
