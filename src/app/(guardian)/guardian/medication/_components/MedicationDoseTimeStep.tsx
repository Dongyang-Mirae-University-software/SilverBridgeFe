'use client';

import classNames from 'classnames/bind';

import { MedicationTimeSlot } from '@/service/interface/medication';
import {
  DOSE_CHIPS,
  DoseGroup,
  getGroupTitle,
  getTimesMismatchHint,
  SLOT_ORDER,
  toggleSlot,
} from '@/utils/medication/medicationDraft';
import styles from './MedicationAddModal.module.css';

const cx = classNames.bind(styles);

interface MedicationDoseTimeStepProps {
  groups: DoseGroup[];
  selections: Record<string, MedicationTimeSlot[]>;
  doneKeys: ReadonlySet<string>; // 이미 등록된 줄 - 다시 보내지 않도록 잠근다
  disabled: boolean;
  onChange: (groupKey: string, slots: MedicationTimeSlot[]) => void;
}

// "약 추가" 2/2 언제 드세요? - 칩 여러 개 선택. 하루 횟수가 다른 약은 줄을 나눠 따로 고른다
export function MedicationDoseTimeStep({ groups, selections, doneKeys, disabled, onChange }: MedicationDoseTimeStepProps) {
  const showTitles = groups.length > 1;

  return (
    <div className={cx('doseGroups')}>
      {groups.map(group => {
        const selected = selections[group.key] ?? [];
        const done = doneKeys.has(group.key);
        const title = showTitles ? getGroupTitle(group) : undefined;
        const hint = getTimesMismatchHint(group, selected);
        return (
          <section key={group.key} className={cx('doseGroup')} aria-label={title ?? '드시는 때'}>
            {title && (
              <p className={cx('doseGroupTitle')}>
                {title}
                {done && <span className={cx('doneBadge')}>등록됨</span>}
              </p>
            )}
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
                    aria-label={title ? `${title} - ${chip.label} ${chip.timeLabel}` : `${chip.label} ${chip.timeLabel}`}
                    onClick={() => onChange(group.key, toggleSlot(selected, slot))}
                    disabled={disabled || done}
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
      })}
    </div>
  );
}
