'use client';

import { useIsMutating, useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { Icon } from '@/components/Icon';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import {
  useMedicationIntakeBatchMutation,
  wardTodayMedicationQueryKey,
  wardTodayMedicationQueryOptions,
} from '@/service/query/ward/medication';
import {
  formatDoseAmount,
  formatDoseTime,
  getMedicationTimeSlotLabel,
  groupMedicationsByTime,
  summarizeMedicationNames,
} from '@/utils/format/medication';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const takenCount = data?.takenCount ?? 0;
  const totalCount = data?.totalCount ?? 0;
  const medications = data?.medications ?? [];
  // 같은 시간대·시각의 약은 한 묶음 - "아침 약 다 먹었어요" 한 번으로 체크한다(2026-10-23, 6번 누르던 것을 대신)
  const groups = groupMedicationsByTime(medications, '00:00', data?.doseDate ?? '');
  const nextGroup = groups.find(group => group.medications.some(medication => !medication.taken));
  const nextUntaken = nextGroup?.medications.filter(medication => !medication.taken) ?? [];
  const batchMutation = useMedicationIntakeBatchMutation();
  // 약 하나 체크와 묶음 체크가 겹치지 않게 둘 중 하나라도 처리 중이면 모든 체크 버튼을 잠근다
  const isChanging = useIsMutating({ mutationKey: ['ward-medication-intake'] }) > 0;
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
              <span className={cx('summaryCheck')}>
                <Icon name="check" color="#fff" size={30} decorative />
              </span>
              <div>
                <strong>오늘 약을 모두 드셨어요</strong>
                <span>보호자에게도 알려 드렸어요</span>
              </div>
            </section>
          ) : nextGroup ? (
            <section className={cx('summaryCard')}>
              <span className={cx('summaryIcon')}>
                <Icon name="pill" size={34} decorative />
              </span>
              <div className={cx('summaryCopy')}>
                <span>
                  다음에 드실 약 · {getMedicationTimeSlotLabel(nextGroup.timeSlot)} {formatDoseTime(nextGroup.doseTime)}
                </span>
                {nextUntaken.length === 1 ? (
                  <strong>
                    {nextUntaken[0].name} {formatDoseAmount(nextUntaken[0].doseAmount)}
                  </strong>
                ) : (
                  <>
                    <strong>약 {nextUntaken.length}개</strong>
                    <em>{summarizeMedicationNames(nextUntaken)}</em>
                  </>
                )}
                {nextUntaken.length === 1 && nextUntaken[0].memo && <em>{nextUntaken[0].memo}에 드세요</em>}
              </div>
              <button
                type="button"
                className={cx('summaryButton')}
                disabled={isChanging}
                onClick={() =>
                  batchMutation.mutate({ medicationIds: nextUntaken.map(medication => medication.medicationId), taken: true })
                }
              >
                <Icon name="check" size={24} decorative />
                {nextUntaken.length === 1 ? '먹었어요' : `${getMedicationTimeSlotLabel(nextGroup.timeSlot)} 약 다 먹었어요`}
              </button>
            </section>
          ) : null}

          {groups.map(group => {
            const untaken = group.medications.filter(medication => !medication.taken);
            return (
              <section key={group.key} className={cx('listCard')} aria-label={`${group.label} 약`}>
                <header className={cx('groupHeader')}>
                  <div className={cx('groupTitle')}>
                    <strong>{getMedicationTimeSlotLabel(group.timeSlot)}</strong>
                    <span>
                      {formatDoseTime(group.doseTime)} · 약 {group.medications.length}개
                    </span>
                  </div>
                  {untaken.length === 0 ? (
                    <span className={cx('groupDone')}>
                      <Icon name="check" size={20} decorative />다 드셨어요
                    </span>
                  ) : (
                    group.medications.length > 1 && (
                      <button
                        type="button"
                        className={cx('groupButton')}
                        disabled={isChanging}
                        onClick={() =>
                          batchMutation.mutate({ medicationIds: untaken.map(medication => medication.medicationId), taken: true })
                        }
                      >
                        다 먹었어요
                      </button>
                    )
                  )}
                </header>
                <ul className={cx('list')}>
                  {group.medications.map(medication => (
                    <WardMedicationCard key={medication.medicationId} medication={medication} disabled={isChanging} />
                  ))}
                </ul>
              </section>
            );
          })}
          <p className={cx('toggleHint')}>잘못 눌렀다면 그 약의 버튼을 한 번 더 누르세요</p>
        </>
      )}
    </section>
  );
}
