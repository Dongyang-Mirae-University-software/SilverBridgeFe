'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import { MedicationItem, MedicationTimeSlot } from '@/service/interface/medication';
import { getMedicationTimeSlotLabel } from '@/utils/format/medication';
import styles from './MedicationFormModal.module.css';

const cx = classNames.bind(styles);

const TIME_SLOTS: MedicationTimeSlot[] = ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'];
const MIN_DOSE_AMOUNT = 1;
const MAX_DOSE_AMOUNT = 10;

interface MedicationFormValue {
  name: string;
  timeSlot: MedicationTimeSlot;
  doseTime: string; // "HH:mm"
  doseAmount: number;
  memo: string;
}

interface MedicationFormModalProps {
  wardName: string;
  initial?: MedicationItem;
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (value: MedicationFormValue) => void;
  onClose: () => void;
}

function toFormValue(initial?: MedicationItem): MedicationFormValue {
  return {
    name: initial?.name ?? '',
    timeSlot: initial?.timeSlot ?? 'MORNING',
    doseTime: initial ? initial.doseTime.slice(0, 5) : '',
    doseAmount: initial?.doseAmount ?? 1,
    memo: initial?.memo ?? '',
  };
}

export function MedicationFormModal({ initial, isSubmitting, errorMessage, onSubmit, onClose }: MedicationFormModalProps) {
  const [value, setValue] = useState<MedicationFormValue>(() => toFormValue(initial));
  const isEdit = Boolean(initial);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.name.trim() || isSubmitting) return;
    onSubmit(value);
  };

  const adjustDoseAmount = (delta: number) => {
    setValue(current => ({
      ...current,
      doseAmount: Math.min(MAX_DOSE_AMOUNT, Math.max(MIN_DOSE_AMOUNT, current.doseAmount + delta)),
    }));
  };

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <form
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? '약 수정' : '약 추가'}
        onClick={event => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className={cx('header')}>
          <h3>{isEdit ? '약 수정' : '약 추가'}</h3>
          <button type="button" className={cx('close')} onClick={onClose} aria-label="닫기">
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
                onChange={event =>
                  setValue(current => ({ ...current, timeSlot: event.target.value as MedicationTimeSlot }))
                }
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
                onChange={event => setValue(current => ({ ...current, doseTime: event.target.value }))}
              />
            </label>
          </div>

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
              <span>{value.doseAmount}알</span>
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
            {isSubmitting ? '저장 중...' : isEdit ? '수정' : '등록'}
          </button>
        </footer>
      </form>
    </div>
  );
}

export type { MedicationFormValue };
