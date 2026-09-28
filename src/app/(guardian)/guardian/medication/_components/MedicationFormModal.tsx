'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import { MedicationItem, MedicationTimeSlot } from '@/service/interface/medication';
import { getMedicationTimeSlotLabel } from '@/utils/format/medication';
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

export function MedicationFormModal({
  wardName,
  initial,
  isSubmitting,
  errorMessage,
  onSubmit,
  onClose,
}: MedicationFormModalProps) {
  const [value, setValue] = useState<MedicationFormValue>(() => toFormValue(initial));
  const isEdit = Boolean(initial);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.name.trim() || isSubmitting) return;
    onSubmit(value);
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
          <div>
            <span className={cx('eyebrow')}>{wardName}</span>
            <h2>{isEdit ? '약 수정' : '약 추가'}</h2>
          </div>
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

          <label className={cx('field')}>
            시간대
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

          <div className={cx('fieldRow')}>
            <label className={cx('field')}>
              복용 시각
              <input
                type="time"
                value={value.doseTime}
                onChange={event => setValue(current => ({ ...current, doseTime: event.target.value }))}
              />
              <span className={cx('hint')}>비워두면 시간대 기본 시각으로 설정됩니다.</span>
            </label>

            <label className={cx('field')}>
              용량(정)
              <input
                type="number"
                min={1}
                max={99}
                value={value.doseAmount}
                onChange={event =>
                  setValue(current => ({ ...current, doseAmount: Number(event.target.value) || 1 }))
                }
              />
            </label>
          </div>

          <label className={cx('field')}>
            메모
            <input
              value={value.memo}
              onChange={event => setValue(current => ({ ...current, memo: event.target.value }))}
              maxLength={100}
              placeholder="예) 식후 30분"
            />
          </label>

          {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
        </div>

        <footer className={cx('footer')}>
          <button type="button" className={cx('cancelButton')} onClick={onClose} disabled={isSubmitting}>
            취소
          </button>
          <button type="submit" className={cx('submitButton')} disabled={!value.name.trim() || isSubmitting}>
            {isSubmitting ? '저장 중...' : isEdit ? '수정' : '추가'}
          </button>
        </footer>
      </form>
    </div>
  );
}

export type { MedicationFormValue };
