'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import { useModalDialog } from '@/hooks/useModalDialog';

import { MedicationItem, MedicationTimeSlot } from '@/service/interface/medication';
import { getMedicationTimeSlotLabel } from '@/utils/format/medication';
import {
  decreaseDose,
  formatDoseLabel,
  increaseDose,
  MAX_DOSE_AMOUNT,
  MIN_DOSE_AMOUNT,
} from '@/utils/medication/medicationDraft';
import styles from './MedicationFormModal.module.css';

const cx = classNames.bind(styles);

const TIME_SLOTS: MedicationTimeSlot[] = ['MORNING', 'LUNCH', 'DINNER', 'BEDTIME'];

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
  return {
    name: initial.name,
    timeSlot: initial.timeSlot,
    doseTime: initial.doseTime.slice(0, 5),
    doseAmount: initial.doseAmount,
    memo: initial.memo ?? '',
  };
}

export function MedicationFormModal({ initial, isSubmitting, errorMessage, onSubmit, onClose }: MedicationFormModalProps) {
  const [value, setValue] = useState<MedicationFormValue>(() => toFormValue(initial));
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

  // 반알(0.5) → 1알 → 2알 … (등록과 같은 0.5 단위 규칙)
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
              <span>{formatDoseLabel(value.doseAmount)}</span>
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
