'use client';

import classNames from 'classnames/bind';

import { MedicationTimeSlot } from '@/service/interface/medication';
import { DOSE_CHIPS, DoseGroup, getTimesMismatchHint, SLOT_ORDER, toggleSlot } from '@/utils/medication/medicationDraft';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

interface MedicationDoseTimeStepProps {
  group: DoseGroup;
  selected: MedicationTimeSlot[];
  mixedNote: string | null; // 약마다 봉투의 하루 횟수가 다를 때의 한 줄 안내
  disabled: boolean;
  onChange: (slots: MedicationTimeSlot[]) => void;
}

// "약 추가" 2/2 언제 드세요? - 모든 약에 같은 시간. 칩 여러 개 선택
export function MedicationDoseTimeStep({ group, selected, mixedNote, disabled, onChange }: MedicationDoseTimeStepProps) {
  // 칩을 모두 끄면 [등록]이 왜 꺼졌는지 알린다(이때는 횟수 안내 대신)
  const hint = selected.length === 0 ? '시간을 하나 이상 골라 주세요' : getTimesMismatchHint(group, selected);
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
      {mixedNote && <p className={cx('timesHint')}>{mixedNote}</p>}
    </section>
  );
}
