'use client';

import { FormEvent, useId, useState } from 'react';
import classNames from 'classnames/bind';

import { useModalDialog } from '@/hooks/useModalDialog';

import { MedicationItem, MedicationTimeSlot } from '@/service/interface/medication';
import { formatDoseAmount, getMedicationTimeSlotLabel } from '@/utils/format/medication';
import {
  decreaseDose,
  DOSE_CHIPS,
  increaseDose,
  MAX_DOSE_AMOUNT,
  MIN_DOSE_AMOUNT,
} from '@/utils/medication/medicationDraft';
import styles from './MedicationFormModal.module.css';

const cx = classNames.bind(styles);

const TIME_SLOTS: MedicationTimeSlot[] = ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'];

// 복용 시각으로 시간대를 정한다 - BE MedicationTimeSlot.fromDoseTime·일괄 등록과 같은 규칙
// (04~10시 아침 / 11~15시 점심 / 16~20시 저녁 / 그 외 취침 전). 시간대와 시각이 따로 움직이면 "점심 01:40" 같은
// 약이 생겨 시간대 칸 순서와 알림 묶음 문구가 틀어졌다(2026-10-30 gosky)
function slotFromTime(hhmm: string): MedicationTimeSlot | null {
  const hour = Number(hhmm.slice(0, 2));
  if (!/^\d{2}:\d{2}/.test(hhmm) || Number.isNaN(hour)) return null;
  if (hour >= 4 && hour < 11) return 'MORNING';
  if (hour >= 11 && hour < 16) return 'LUNCH';
  if (hour >= 16 && hour < 21) return 'DINNER';
  return 'BEDTIME';
}

interface MedicationFormValue {
  name: string;
  timeSlot: MedicationTimeSlot;
  doseTime: string; // "HH:mm"
  doseAmount: number;
  memo: string;
}

interface MedicationFormModalProps {
  wardName: string;
  initial: MedicationItem;
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (value: MedicationFormValue) => void;
  onClose: () => void;
}

function toFormValue(initial: MedicationItem): MedicationFormValue {
  const doseTime = initial.doseTime.slice(0, 5);
  return {
    name: initial.name,
    // 이미 어긋나 저장된 옛 약도 열 때부터 시각에 맞는 시간대로 보여 준다 - 저장하면 바로잡힌다
    timeSlot: slotFromTime(doseTime) ?? initial.timeSlot,
    doseTime,
    doseAmount: initial.doseAmount,
    memo: initial.memo ?? '',
  };
}

export function MedicationFormModal({ initial, isSubmitting, errorMessage, onSubmit, onClose }: MedicationFormModalProps) {
  const [value, setValue] = useState<MedicationFormValue>(() => toFormValue(initial));
  const slotHintId = useId();
  // 저장 중에 닫으면 실패 안내를 볼 수 없다 - 저장이 끝날 때까지 닫지 않는다
  const requestClose = () => {
    if (isSubmitting) return;
    onClose();
  };
  const { dialogRef, onDialogKeyDown, overlayProps } = useModalDialog<HTMLFormElement>({
    onRequestClose: requestClose,
    initialFocusSelector: 'input',
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.name.trim() || isSubmitting) return;
    onSubmit(value);
  };

  // 반 알(0.5) → 1정 → 2정 … (등록과 같은 0.5 단위 규칙)
  const adjustDoseAmount = (direction: 1 | -1) => {
    setValue(current => ({
      ...current,
      doseAmount: direction > 0 ? increaseDose(current.doseAmount) : decreaseDose(current.doseAmount),
    }));
  };

  return (
    <div className={cx('overlay')} role="presentation" {...overlayProps}>
      <form
        ref={dialogRef}
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="약 수정"
        onSubmit={handleSubmit}
        onKeyDown={onDialogKeyDown}
      >
        <header className={cx('header')}>
          <h3>약 수정</h3>
          <button type="button" className={cx('close')} onClick={requestClose} disabled={isSubmitting} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('body')}>
          <label className={cx('field')}>
            약 이름
            <input
              value={value.name}
              onChange={event => setValue(current => ({ ...current, name: event.target.value }))}
              maxLength={100}
              placeholder="예) 혈압약 (암로디핀 5mg)"
              required
            />
          </label>

          <div className={cx('fieldRow')}>
            <label className={cx('field')}>
              복용 시간
              <select
                value={value.timeSlot}
                onChange={event => {
                  // 시간대를 고르면 시각을 그 시간대의 기본 시각으로(약 추가 칩과 같은 08·12·19·21시)
                  const timeSlot = event.target.value as MedicationTimeSlot;
                  setValue(current => ({ ...current, timeSlot, doseTime: DOSE_CHIPS[timeSlot].time }));
                }}
              >
                {TIME_SLOTS.map(slot => (
                  <option key={slot} value={slot}>
                    {getMedicationTimeSlotLabel(slot)}
                  </option>
                ))}
              </select>
            </label>

            <label className={cx('field')}>
              복용 시각
              <input
                type="time"
                value={value.doseTime}
                onChange={event => {
                  // 시각을 바꾸면 시간대가 따라간다(지우는 중처럼 시각이 비면 시간대는 그대로)
                  const doseTime = event.target.value;
                  setValue(current => ({ ...current, doseTime, timeSlot: slotFromTime(doseTime) ?? current.timeSlot }));
                }}
                aria-describedby={slotHintId}
              />
            </label>
          </div>
          <p id={slotHintId} className={cx('slotHint')}>
            복용 시간은 시각에 맞춰 정해져요 (오전 4시~10시 아침 · 11시~오후 3시 점심 · 오후 4시~8시 저녁 · 그 외 취침 전)
          </p>

          <label className={cx('field')}>
            복용량
            <div className={cx('stepper')}>
              <button
                type="button"
                onClick={() => adjustDoseAmount(-1)}
                disabled={value.doseAmount <= MIN_DOSE_AMOUNT}
                aria-label="복용량 줄이기"
              >
                −
              </button>
              <span>{formatDoseAmount(value.doseAmount)}</span>
              <button
                type="button"
                onClick={() => adjustDoseAmount(1)}
                disabled={value.doseAmount >= MAX_DOSE_AMOUNT}
                aria-label="복용량 늘리기"
              >
                +
              </button>
            </div>
          </label>

          <label className={cx('field')}>
            메모 <span className={cx('optional')}>(선택)</span>
            <input
              value={value.memo}
              onChange={event => setValue(current => ({ ...current, memo: event.target.value }))}
              maxLength={100}
              placeholder="예) 식사와 함께"
            />
          </label>

          {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
        </div>

        <footer className={cx('footer')}>
          <button type="button" className={cx('cancelButton')} onClick={onClose} disabled={isSubmitting}>
            취소
          </button>
          <button type="submit" className={cx('submitButton')} disabled={!value.name.trim() || isSubmitting}>
            {isSubmitting ? '저장 중...' : '수정'}
          </button>
        </footer>
      </form>
    </div>
  );
}

export type { MedicationFormValue };
