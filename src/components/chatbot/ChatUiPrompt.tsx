'use client';

import { useState } from 'react';
import type { ChatUiPromptData } from '@/service/interface/chat';
import { formatDateShort, kstToday } from '@/utils/reservation/reservationView';
import { PERSONAL_FIELDS } from './reservationFlow';
import styles from './ChatUiPrompt.module.css';

interface Props {
  ui: ChatUiPromptData;
  active: boolean;
  onSelect: (field: string, value: string, label?: string) => void;
  /** 피보호자 화면은 글자·버튼을 더 크게 한다(보호자 화면도 터치 48px 이상). */
  variant?: 'guardian' | 'ward';
  /** 이름·전화 칸이 왔을 때 [처음으로 돌아가기]를 누르면 대화를 새로 시작한다. */
  onRestart?: () => void;
  /** 피보호자 예약 진행 패널 안 - 선택지를 한 줄에 하나씩 큰 버튼(96px)으로 놓는다(2026-11-12 화면 개편). */
  panel?: boolean;
}

export default function ChatUiPrompt({ ui, active, onSelect, variant = 'guardian', onRestart, panel = false }: Props) {
  const [textVal, setTextVal] = useState('');
  const [dateVal, setDateVal] = useState('');
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const wrapClass = `${styles.wrap} ${variant === 'ward' ? styles.ward : styles.guardian} ${panel ? styles.panel : ''}`;

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
        <div className={`${wrapClass} ${styles.reservationSelect}`}>
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
      <div
        className={`${wrapClass} ${isTimeSelection ? styles.timeSelect : ''} ${
          options.length === 1 ? styles.single : ''
        }`}
      >
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
    // 가까운 날은 AI가 선택지(kind=select)로 준다(AI #175). 달력은 [달력에서 다른 날 고르기]를 누른 뒤에만 오므로 바로 펼친다.
    const today = kstToday();
    return (
      <div className={`${wrapClass} ${styles.dateSelect}`}>
        <p className={styles.label}>달력에서 날짜를 골라 주세요</p>
        <div className={styles.inputRow}>
          <input
            type="date"
            className={styles.dateInput}
            aria-label={ui.label ?? '날짜 선택'}
            min={today}
            value={dateVal}
            disabled={!active}
            onChange={e => setDateVal(e.target.value)}
          />
          <button
            type="button"
            className={styles.applyBtn}
            disabled={!active || !dateVal}
            onClick={() => apply(dateVal, formatDateShort(dateVal))}
          >
            적용
          </button>
        </div>
        {!active && <p className={styles.inactiveNote}>이전 대화의 선택지입니다.</p>}
      </div>
    );
  }

  if (ui.kind === 'text' && PERSONAL_FIELDS.has(ui.field)) {
    // 이름·전화는 서버가 계정 정보로 채운다 - 직접 입력하는 칸을 두지 않는다(등록된 전화가 없을 때만 이 칸이 온다).
    return (
      <div className={`${wrapClass} ${styles.notice}`} role="note">
        <p className={styles.noticeText}>
          {variant === 'ward'
            ? '등록된 전화번호가 없어 여기서는 예약할 수 없어요. 보호자에게 예약을 부탁해 주세요.'
            : '피보호자 전화번호가 등록되어 있지 않아 예약할 수 없어요. 피보호자 내 정보에서 전화번호를 등록한 뒤 다시 예약해 주세요.'}
        </p>
        {active && onRestart && (
          <div className={`${styles.chips} ${styles.single}`}>
            <button type="button" className={styles.chip} onClick={onRestart}>
              처음으로 돌아가기
            </button>
          </div>
        )}
      </div>
    );
  }

  if (ui.kind === 'text') {
    return (
      <div className={wrapClass}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.textInput}
            aria-label={ui.label ?? ui.placeholder ?? '답 입력'}
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
