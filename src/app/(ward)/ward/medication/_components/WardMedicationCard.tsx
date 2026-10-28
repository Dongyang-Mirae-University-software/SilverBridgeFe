import classNames from 'classnames/bind';

import { MedicationItem } from '@/service/interface/medication';
import { Icon } from '@/components/Icon';
import { formatDoseAmount, formatDoseTimeKorean } from '@/utils/format/medication';
import styles from './WardMedicationCard.module.css';

const cx = classNames.bind(styles);

interface WardMedicationCardProps {
  medication: MedicationItem;
  beforeRegistered?: boolean; // 오늘 복용 시각이 지난 뒤 등록된 약 - 그날은 체크 대상이 아니다
  disabled?: boolean;
  onTake: (taken: boolean) => void;
}

// v13: 오늘 약은 시간·이름·상태/동작을 한 줄에 보여 준다.
// 체크 API는 기존 묶음 API를 약 ID 하나로 호출하므로, 서버 데이터 모델은 바꾸지 않는다.
export function WardMedicationCard({ medication, beforeRegistered = false, disabled = false, onTake }: WardMedicationCardProps) {
  return (
    <li className={cx('row', { taken: medication.taken, muted: beforeRegistered && !medication.taken })}>
      <time className={cx('time')}>{formatDoseTimeKorean(medication.doseTime)}</time>
      <div className={cx('meta')}>
        <strong className={cx('name')}>{medication.name}</strong>
        <span className={cx('memo')}>
          {formatDoseAmount(medication.doseAmount)}{medication.memo ? ` · ${medication.memo}` : ''}
        </span>
      </div>
      {medication.taken ? (
        <button
          type="button"
          className={cx('stateButton', 'done')}
          disabled={disabled}
          onClick={() => onTake(false)}
          aria-label={`${medication.name} 복용 체크 되돌리기`}
        >
          <Icon name="check" size={20} decorative />
          먹었어요
        </button>
      ) : beforeRegistered ? (
        <span className={cx('state')}>내일부터 드세요</span>
      ) : (
        <button
          type="button"
          className={cx('takeButton')}
          disabled={disabled}
          onClick={() => onTake(true)}
          aria-label={`${medication.name} 먹었어요`}
        >
          먹었어요
        </button>
      )}
    </li>
  );
}
