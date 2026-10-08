'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { Icon } from '@/components/Icon';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import { useMedicationIntakeMutation, wardTodayMedicationQueryKey, wardTodayMedicationQueryOptions } from '@/service/query/ward/medication';
import { formatDoseTime, getMedicationTimeSlotLabel, sortMedicationsByDoseTime } from '@/utils/format/medication';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const takenCount = data?.takenCount ?? 0;
  const totalCount = data?.totalCount ?? 0;
  const medications = sortMedicationsByDoseTime(data?.medications ?? []);
  const nextMedication = medications.find(medication => !medication.taken);
  const intakeMutation = useMedicationIntakeMutation();
  const isAllTaken = totalCount > 0 && takenCount === totalCount;

  return (
    <section className={cx('page')}>
      <header className={cx('toolbar')}>
        <RefreshButton ariaLabel="새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      {isLoading && <p className={cx('emptyText')}>복약 일정을 불러오는 중입니다.</p>}
      {isError && <p className={cx('emptyText')}>복약 일정을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && medications.length === 0 && (
        <p className={cx('emptyText')}>오늘 등록된 복약 일정이 없습니다.</p>
      )}
      {!isLoading && !isError && medications.length > 0 && (
        <>
          {isAllTaken ? (
            <section className={cx('summaryCard', 'allTaken')}>
              <span className={cx('summaryCheck')}><Icon name="check" size={30} decorative /></span>
              <div><strong>오늘 약을 모두 드셨어요</strong><span>보호자에게도 알려 드렸어요</span></div>
            </section>
          ) : nextMedication ? (
            <section className={cx('summaryCard')}>
              <span className={cx('summaryIcon')}><Icon name="pill" size={34} decorative /></span>
              <div className={cx('summaryCopy')}>
                <span>다음에 드실 약 · {getMedicationTimeSlotLabel(nextMedication.timeSlot)} {formatDoseTime(nextMedication.doseTime)}</span>
                <strong>{nextMedication.name} {nextMedication.doseAmount}정</strong>
                {nextMedication.memo && <em>{nextMedication.memo}에 드세요</em>}
              </div>
              <button
                type="button"
                className={cx('summaryButton')}
                disabled={intakeMutation.isPending}
                onClick={() => intakeMutation.mutate({ medicationId: nextMedication.medicationId, taken: true })}
              >
                <Icon name="check" size={24} decorative />먹었어요
              </button>
            </section>
          ) : null}

          <section className={cx('listCard')}>
            <ul className={cx('list')}>
              {medications.map(medication => <WardMedicationCard key={medication.medicationId} medication={medication} />)}
            </ul>
          </section>
          <p className={cx('toggleHint')}>잘못 눌렀다면 버튼을 한 번 더 누르세요</p>
        </>
      )}
    </section>
  );
}
