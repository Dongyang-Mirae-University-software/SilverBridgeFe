import classNames from 'classnames/bind';

import { MedicationItem } from '@/service/interface/medication';
import { Icon } from '@/components/Icon';
import { formatDoseAmount } from '@/utils/format/medication';
import styles from './WardMedicationCard.module.css';
import { useMedicationIntakeMutation } from '@/service/query/ward';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  medication: MedicationItem;
  disabled?: boolean; // 묶음 체크 등 다른 체크가 처리 중일 때
}

// 약 하나 - 시간대는 묶음 머리(WardMedicationContent)에 있다. 잘못 누른 약 하나만 풀 때도 이 버튼을 쓴다
export function WardMedicationCard({ medication, disabled = false }: WardMedicationCardProps) {
  const intakeMutation = useMedicationIntakeMutation();

  const handleToggle = (medication: MedicationItem) => {
    if (intakeMutation.isPending || disabled) return;
    intakeMutation.mutate({ medicationId: medication.medicationId, taken: !medication.taken });
  };

  return (
    <li className={cx('card', { taken: medication.taken })}>
      <div className={cx('cardMeta')}>
        <strong className={cx('name')}>{medication.name}</strong>
        <span className={cx('detail')}>
          {formatDoseAmount(medication.doseAmount)}{medication.memo ? ` · ${medication.memo}` : ''}
        </span>
      </div>
      <button
        type="button"
        className={cx('checkButton', { checked: medication.taken })}
        disabled={intakeMutation.isPending || disabled}
        onClick={() => handleToggle(medication)}
        aria-pressed={medication.taken}
        aria-label={`${medication.name} ${medication.taken ? '먹었어요' : '안 먹었어요'}`}
      >
        {medication.taken ? <><Icon name="check" size={22} decorative />먹었어요</> : '안 먹었어요'}
      </button>
    </li>
  );
}
