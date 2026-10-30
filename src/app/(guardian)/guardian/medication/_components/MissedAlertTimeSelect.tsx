'use client';

import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { formatMedicationAlertTime } from '@/utils/format/medication';
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface MissedAlertTimeSelectProps {
  value: string; // "21:00:00"
  disabled?: boolean;
  onConfirm: (hhmm: string) => void; // "22:30"
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function parse(value: string) {
  const [h = '21', m = '00'] = value.split(':');
  const hour = Number(h);
  const minute = Number(m);
  return { pm: hour >= 12, h12: hour % 12 || 12, minute: Number.isFinite(minute) ? minute : 0 };
}

function toHHmm(pm: boolean, h12: number, minute: number) {
  const hour = (h12 % 12) + (pm ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// "이 시간까지 안 드시면 나에게 알림" 시간 고르기 - 오전/오후·시·분(5분 단위) 세 칸 + "○○로 정하기"(Claude Design 시안, 2026-10-24)
// 칸을 누르면 고르기만 하고, [로 정하기]를 눌러야 저장한다. 바깥을 누르거나 Esc를 누르면 저장하지 않고 닫는다
export function MissedAlertTimeSelect({ value, disabled = false, onConfirm }: MissedAlertTimeSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parse(value));
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const draftLabel = formatMedicationAlertTime(toHHmm(draft.pm, draft.h12, draft.minute));

  const toggle = () => {
    if (!open) setDraft(parse(value));
    setOpen(current => !current);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    // 열면 고른 값이 각 칸 가운데에 오게
    panelRef.current?.querySelectorAll<HTMLElement>('[data-col]').forEach(col => {
      const on = col.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (on) col.scrollTop = on.offsetTop - col.offsetTop - col.clientHeight / 2 + on.offsetHeight / 2;
    });
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const column = <T,>(label: string, items: [T, string][], current: T, pick: (item: T) => void) => (
    <div className={cx('tpCol')} data-col role="group" aria-label={label}>
      {items.map(([item, text]) => (
        <button
          key={text}
          type="button"
          className={cx('tpItem', { on: item === current })}
          aria-pressed={item === current}
          onClick={() => pick(item)}
        >
          {text}
        </button>
      ))}
    </div>
  );

  return (
    <span
      ref={rootRef}
      className={cx('timeSelect')}
      // Esc = 저장하지 않고 닫기, 포커스는 연 버튼으로(점검 L-1)
      onKeyDown={event => {
        if (!open || event.key !== 'Escape') return;
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={cx('timeSelectButton', { open })}
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-label={`안 드시면 알림 받을 시각 ${formatMedicationAlertTime(value)}, 바꾸기`}
      >
        {formatMedicationAlertTime(value)}
        <span aria-hidden="true">▼</span>
      </button>
      {open && (
        <div ref={panelRef} className={cx('timePanel')}>
          <div className={cx('tpCols')}>
            {column<boolean>('오전 오후', [[false, '오전'], [true, '오후']], draft.pm, pm => setDraft(d => ({ ...d, pm })))}
            {column<number>('시', HOURS.map(h => [h, String(h)]), draft.h12, h12 => setDraft(d => ({ ...d, h12 })))}
            {column<number>(
              '분',
              MINUTES.map(m => [m, String(m).padStart(2, '0')]),
              draft.minute,
              minute => setDraft(d => ({ ...d, minute })),
            )}
          </div>
          <button
            type="button"
            className={cx('timeConfirm')}
            onClick={() => {
              onConfirm(toHHmm(draft.pm, draft.h12, draft.minute));
              setOpen(false);
            }}
          >
            {draftLabel}로 정하기
          </button>
        </div>
      )}
    </span>
  );
}
