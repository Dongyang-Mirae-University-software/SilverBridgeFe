import classNames from 'classnames/bind';

import { MedicationItem } from '@/service/interface/medication';
import { Icon } from '@/components/Icon';
import { formatDoseTime, getMedicationTimeSlotLabel } from '@/utils/format/medication';
import styles from './WardMedicationCard.module.css';
import { useMedicationIntakeMutation } from '@/service/query/ward';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  medication: MedicationItem;
}

export function WardMedicationCard({ medication }: WardMedicationCardProps) {
  const intakeMutation = useMedicationIntakeMutation();

  const handleToggle = (medication: MedicationItem) => {
    if (intakeMutation.isPending) return;
    intakeMutation.mutate({ medicationId: medication.medicationId, taken: !medication.taken });
  };

  return (
    <li className={cx('card', { taken: medication.taken })}>
      <span className={cx('slot')}>
        <strong>{getMedicationTimeSlotLabel(medication.timeSlot)}</strong>
        <span>{formatDoseTime(medication.doseTime)}</span>
      </span>
      <div className={cx('cardMeta')}>
        <strong className={cx('name')}>{medication.name}</strong>
        <span className={cx('detail')}>
          {medication.doseAmount}정{medication.memo ? ` · ${medication.memo}` : ''}
        </span>
      </div>
      <button
        type="button"
        className={cx('checkButton', { checked: medication.taken })}
        disabled={intakeMutation.isPending}
        onClick={() => handleToggle(medication)}
        aria-pressed={medication.taken}
      >
        {medication.taken ? <><Icon name="check" size={22} decorative />먹었어요</> : '안 먹었어요'}
      </button>
    </li>
  );
}
