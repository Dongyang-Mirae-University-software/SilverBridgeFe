import classNames from 'classnames/bind';

import { MedicationItem } from '@/service/interface/medication';
import { Icon } from '@/components/Icon';
import { formatDoseAmount } from '@/utils/format/medication';
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  medication: MedicationItem;
  beforeRegistered?: boolean; // 오늘 복용 시각이 지난 뒤 등록된 약 - 그날은 체크 대상이 아니다
}

// 펼친 시간대 카드 안의 약 한 줄 - 체크는 시간대 버튼으로만 한다(2026-10-24 디자인, 약마다 누르던 버튼 대신)
export function WardMedicationCard({ medication, beforeRegistered = false }: WardMedicationCardProps) {
  return (
    <li className={cx('row', { taken: medication.taken, muted: beforeRegistered && !medication.taken })}>
      <div className={cx('meta')}>
        <strong className={cx('name')}>{medication.name}</strong>
        {medication.taken ? (
          <span className={cx('state', 'done')}>
            <Icon name="check" size={18} decorative />
            먹었어요
          </span>
        ) : beforeRegistered ? (
          <span className={cx('state')}>오늘은 등록 전이었어요</span>
        ) : medication.memo ? (
          <span className={cx('memo')}>{medication.memo}</span>
        ) : null}
      </div>
      <span className={cx('dose')}>{formatDoseAmount(medication.doseAmount)}</span>
    </li>
  );
}
