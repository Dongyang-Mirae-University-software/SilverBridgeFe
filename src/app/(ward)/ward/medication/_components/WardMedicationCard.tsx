import classNames from 'classnames/bind';

import { MedicationItem } from '@/service/interface/medication';
import { formatDateTime } from '@/utils/format/date';
import { formatDoseTime, getMedicationTimeSlotLabel } from '@/utils/format/medication';
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  medication: MedicationItem;
  disabled: boolean;
  onToggle: (medication: MedicationItem) => void;
}

export function WardMedicationCard({ medication, disabled, onToggle }: WardMedicationCardProps) {
  return (
    <li className={cx('card', { taken: medication.taken })}>
      <div className={cx('cardMeta')}>
        <span className={cx('slot')}>
          {getMedicationTimeSlotLabel(medication.timeSlot)} {formatDoseTime(medication.doseTime)}
        </span>
        <strong className={cx('name')}>{medication.name}</strong>
        <span className={cx('detail')}>
          {medication.doseAmount}정{medication.memo ? ` · ${medication.memo}` : ''}
        </span>
        {medication.taken && medication.takenAt && (
          <span className={cx('takenAt')}>{formatDateTime(medication.takenAt)} 복용 체크</span>
        )}
      </div>
      <button
        type="button"
        className={cx('checkButton', { checked: medication.taken })}
        disabled={disabled}
        onClick={() => onToggle(medication)}
        aria-pressed={medication.taken}
      >
        {medication.taken ? '체크됨' : '복용 체크'}
      </button>
    </li>
  );
}
