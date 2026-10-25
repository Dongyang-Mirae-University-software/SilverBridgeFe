'use client';

import classNames from 'classnames/bind';

import { MedicationTimeSlot } from '@/service/interface/medication';
import { DOSE_CHIPS, SLOT_ORDER, toggleSlot } from '@/utils/medication/medicationDraft';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

interface MedicationDoseTimeStepProps {
  selected: MedicationTimeSlot[];
  disabled: boolean;
  onChange: (slots: MedicationTimeSlot[]) => void;
}

// "약 추가" 2/2 언제 드세요? - 모든 약에 같은 시간. 칩 여러 개 선택
// 봉투 하루 횟수 안내("봉투에는 하루 3번이에요"·"코싹엘정 하루 2번 - …")는 칩 아래 코멘트처럼 보여 뺐다(2026-10-23 사용자 결정)
export function MedicationDoseTimeStep({ selected, disabled, onChange }: MedicationDoseTimeStepProps) {
  // 칩을 모두 끄면 [등록]이 왜 꺼졌는지 알린다
  const hint = selected.length === 0 ? '시간을 하나 이상 골라 주세요' : null;
  return (
    <section className={cx('doseGroup')} aria-label="드시는 때">
      <div className={cx('chips')}>
        {SLOT_ORDER.map(slot => {
          const chip = DOSE_CHIPS[slot];
          const pressed = selected.includes(slot);
          return (
            <button
              key={slot}
              type="button"
              className={cx('chip', { selected: pressed })}
              aria-pressed={pressed}
              aria-label={`${chip.label} ${chip.timeLabel}`}
              onClick={() => onChange(toggleSlot(selected, slot))}
              disabled={disabled}
            >
              <span className={cx('chipLabel')}>{chip.label}</span>
              <span className={cx('chipTime')}>{chip.timeLabel}</span>
            </button>
          );
        })}
      </div>
      {hint && <p className={cx('timesHint')}>{hint}</p>}
    </section>
  );
}
