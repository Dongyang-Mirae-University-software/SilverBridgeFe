'use client';

import { useState } from 'react';
import type { ChatUiPromptData } from '@/service/interface/chat';
import styles from './ChatUiPrompt.module.css';

interface Props {
  ui: ChatUiPromptData;
  active: boolean;
  onSelect: (field: string, value: string, label?: string) => void;
}

export default function ChatUiPrompt({ ui, active, onSelect }: Props) {
  const [textVal, setTextVal] = useState('');
  const [dateVal, setDateVal] = useState('');
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  function apply(value: string, label?: string) {
    if (!value.trim() || !active) return;
    onSelect(ui.field, value.trim(), label);
  }

  if (ui.kind === 'select') {
    const isTimeSelection = ui.field === 'time';
    const isReservationSelection = ui.field === 'reservation_id';
    const options = (ui.options ?? []).map(raw => (typeof raw === 'string' ? { value: raw, label: raw } : raw));

    if (isReservationSelection) {
      return (
        <div className={`${styles.wrap} ${styles.reservationSelect}`}>
          {ui.label && <p className={styles.label}>{ui.label}</p>}
          <div className={styles.reservationPickerRow}>
            <select
              className={styles.reservationPicker}
              value={selectedValue ?? ''}
              disabled={!active}
              aria-label={ui.label ?? '예약 선택'}
              onChange={event => setSelectedValue(event.target.value || null)}
            >
              <option value="">예약을 선택해 주세요</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.reservationApplyButton}
              disabled={!active || !selectedValue}
              onClick={() => {
                const selected = options.find(option => option.value === selectedValue);
                if (selected) apply(selected.value, selected.label);
              }}
            >
              상세 보기
            </button>
          </div>
          {!active && <p className={styles.inactiveNote}>이전 대화의 선택지입니다.</p>}
        </div>
      );
    }

    return (
      <div className={`${styles.wrap} ${isTimeSelection ? styles.timeSelect : ''}`}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.chips}>
          {options.map(opt => {
            const isDateChangeOption = opt.value === '__change_date__';
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!active}
                className={`${styles.chip} ${selectedValue === opt.value ? styles.chipSelected : ''} ${
                  isDateChangeOption ? styles.changeDateChip : ''
                }`}
                onClick={() => {
                  setSelectedValue(opt.value);
                  apply(opt.value, opt.label);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {!active && <p className={styles.inactiveNote}>이전 대화의 선택지입니다.</p>}
      </div>
    );
  }

  if (ui.kind === 'date') {
    return (
      <div className={styles.wrap}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.inputRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={dateVal}
            disabled={!active}
            onChange={e => setDateVal(e.target.value)}
          />
          <button
            type="button"
            className={styles.applyBtn}
            disabled={!active || !dateVal}
            onClick={() => apply(dateVal)}
          >
            적용
          </button>
        </div>
      </div>
    );
  }

  if (ui.kind === 'text') {
    return (
      <div className={styles.wrap}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.textInput}
            value={textVal}
            disabled={!active}
            placeholder={ui.placeholder ?? '입력하세요'}
            onChange={e => setTextVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply(textVal); }}
          />
          <button
            type="button"
            className={styles.applyBtn}
            disabled={!active || !textVal.trim()}
            onClick={() => apply(textVal)}
          >
            적용
          </button>
        </div>
      </div>
    );
  }

  return null;
}
