'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import { formatDateTime } from '@/utils/format/date';
import { formatDoseTime, getMedicationTimeSlotLabel, sortMedicationsByDoseTime } from '@/utils/format/medication';
import {
  wardTodayMedicationQueryKey,
  wardTodayMedicationQueryOptions,
  useMedicationIntakeMutation,
} from '@/service/query/ward/medication';
import { MedicationItem } from '@/service/interface/medication';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  const intakeMutation = useMedicationIntakeMutation();
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const medications = sortMedicationsByDoseTime(data?.medications ?? []);
  const takenCount = data?.takenCount ?? 0;
  const totalCount = data?.totalCount ?? 0;

  const handleToggle = (medication: MedicationItem) => {
    if (intakeMutation.isPending) return;
    intakeMutation.mutate({ medicationId: medication.medicationId, taken: !medication.taken });
  };

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <div>
          <strong className={cx('toolbarTitle')}>오늘의 복약</strong>
          <span className={cx('toolbarSub')}>
            {takenCount}/{totalCount}회 완료
          </span>
        </div>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      {isLoading && <p className={cx('emptyText')}>복약 일정을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>복약 일정을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && medications.length === 0 && (
        <p className={cx('emptyText')}>오늘 등록된 복약 일정이 없습니다.</p>
      )}

      <ul className={cx('list')}>
        {medications.map(medication => (
          <li key={medication.medicationId} className={cx('card', { taken: medication.taken })}>
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
              disabled={intakeMutation.isPending}
              onClick={() => handleToggle(medication)}
              aria-pressed={medication.taken}
            >
              {medication.taken ? '체크됨' : '복용 체크'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
