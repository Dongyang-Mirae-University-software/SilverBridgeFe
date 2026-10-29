'use client';

import { useIsMutating, useMutationState, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { Icon } from '@/components/Icon';
import useKstMidnightRefetch from '@/hooks/useKstMidnightRefetch';
import { MedicationItem } from '@/service/interface/medication';
import {
  useMedicationIntakeBatchMutation,
  wardTodayMedicationQueryKey,
  wardTodayMedicationQueryOptions,
} from '@/service/query/ward/medication';
import {
  formatDoseAmount,
  formatDoseTimeKorean,
  getMedicationTimeSlotLabel,
  isRegisteredAfterDose,
  sortMedicationsByDoseTime,
} from '@/utils/format/medication';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

type MedicationGroup = {
  key: string;
  label: string;
  doseTime: string;
  medications: MedicationItem[];
  actionableMedications: MedicationItem[];
  isTaken: boolean;
  isBeforeRegistered: boolean;
};

function getWardMedicationSlotLabel(timeSlot: MedicationItem['timeSlot']) {
  return timeSlot === 'BEDTIME' ? '자기 전' : getMedicationTimeSlotLabel(timeSlot);
}

function groupMedications(medications: MedicationItem[], doseDate: string): MedicationGroup[] {
  const groups = new Map<string, MedicationItem[]>();
  sortMedicationsByDoseTime(medications).forEach(medication => {
    const key = `${medication.timeSlot}-${medication.doseTime.slice(0, 5)}`;
    groups.set(key, [...(groups.get(key) ?? []), medication]);
  });

  const slotCounts = new Map<MedicationItem['timeSlot'], number>();
  groups.forEach(items => {
    const timeSlot = items[0].timeSlot;
    slotCounts.set(timeSlot, (slotCounts.get(timeSlot) ?? 0) + 1);
  });

  return [...groups.entries()].map(([key, groupedMedications]) => {
    const { doseTime, timeSlot } = groupedMedications[0];
    const actionableMedications = groupedMedications.filter(
      medication => medication.taken || !isRegisteredAfterDose(medication, doseDate),
    );
    const slotLabel = getWardMedicationSlotLabel(timeSlot);

    return {
      key,
      label: (slotCounts.get(timeSlot) ?? 0) > 1 ? `${slotLabel} ${doseTime.slice(0, 5)}` : slotLabel,
      doseTime,
      medications: groupedMedications,
      actionableMedications,
      isTaken: actionableMedications.length > 0 && actionableMedications.every(medication => medication.taken),
      isBeforeRegistered: actionableMedications.length === 0,
    };
  });
}

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const doseDate = data?.doseDate ?? '';
  const medications = sortMedicationsByDoseTime(data?.medications ?? []);
  const medicationGroups = useMemo(() => groupMedications(medications, doseDate), [doseDate, medications]);
  const actionableMedications = medicationGroups.flatMap(group => group.actionableMedications);
  const isAllTaken = actionableMedications.length > 0 && actionableMedications.every(medication => medication.taken);
  const firstIncompleteGroup = medicationGroups.find(group => !group.isTaken && !group.isBeforeRegistered);
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);
  const focusedGroup = medicationGroups.find(group => group.key === focusedGroupKey);
  const selectedGroup = focusedGroup ?? (isAllTaken ? null : firstIncompleteGroup ?? null);

  const batchMutation = useMedicationIntakeBatchMutation();
  // 처리 중이면 모든 버튼을 잠근다 - 연속 탭으로 같은 요청이 두 번 가지 않게
  const isChanging = useIsMutating({ mutationKey: ['ward-medication-intake'] }) > 0;
  // 가장 최근 체크·되돌리기가 실패했으면 안내한다(점검 M-1) - 되돌리기 실패는 문구를 따로(점검 L-2)
  const intakeStates = useMutationState({
    filters: { mutationKey: ['ward-medication-intake'] },
    select: mutation => ({
      status: mutation.state.status,
      taken: (mutation.state.variables as { taken?: boolean } | undefined)?.taken,
    }),
  });
  const lastIntake = intakeStates.at(-1);
  const lastIntakeFailed = lastIntake?.status === 'error';

  // isChanging은 다음 렌더에야 바뀌어 아주 빠른 두 번째 탭은 못 막는다 - 누른 즉시 잠그는 ref를 함께 쓴다
  const sendingRef = useRef(false);
  const setTaken = (medicationIds: number[], taken: boolean) => {
    if (sendingRef.current || isChanging) return;
    sendingRef.current = true;
    batchMutation.mutate(
      { medicationIds, taken },
      {
        onSettled: () => {
          sendingRef.current = false;
        },
      },
    );
  };

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
          {isAllTaken && (
            <section className={cx('allTaken')}>
              <Icon name="check" size={30} decorative />
              오늘 약 다 먹었어요
            </section>
          )}

          {lastIntakeFailed && (
            <p className={cx('intakeError')} role="alert">
              {lastIntake?.taken === false ? '되돌리지 못했어요' : '체크하지 못했어요'}. 목록을 다시 불러왔으니 한 번 더 눌러 주세요
            </p>
          )}

          <section className={cx('slots')} aria-label="오늘 먹을 약 시간대">
            {medicationGroups.map(group => {
              const isSelected = selectedGroup?.key === group.key;
              const groupMedicationIds = group.actionableMedications.map(medication => medication.medicationId);

              if (!isSelected) {
                return (
                  <button
                    key={group.key}
                    type="button"
                    className={cx('slotRow', { done: group.isTaken })}
                    onClick={() => setFocusedGroupKey(group.key)}
                  >
                    <span className={cx('slotName')}>{group.label} 약</span>
                    {group.isTaken ? (
                      <span className={cx('slotDone')}>
                        <Icon name="check" size={22} decorative />
                        먹었어요
                      </span>
                    ) : group.isBeforeRegistered ? (
                      <span className={cx('slotTime')}>내일부터 드세요</span>
                    ) : (
                      <span className={cx('slotTime')}>{formatDoseTimeKorean(group.doseTime)}</span>
                    )}
                  </button>
                );
              }

              if (group.isTaken) {
                return (
                  <section key={group.key} className={cx('doneCard')}>
                    <span className={cx('doneIcon')}>
                      <Icon name="check" color="#fff" size={34} decorative />
                    </span>
                    <strong className={cx('doneText')}>{group.label} 약 다 먹었어요</strong>
                    <button
                      type="button"
                      className={cx('undoButton')}
                      disabled={isChanging}
                      onClick={() => {
                        setFocusedGroupKey(group.key);
                        setTaken(groupMedicationIds, false);
                      }}
                    >
                      되돌리기
                    </button>
                  </section>
                );
              }

              if (group.isBeforeRegistered) {
                return (
                  <section key={group.key} className={cx('nowCard')}>
                    <div className={cx('nowHead')}>
                      <strong>{group.label} 약</strong>
                      <span>내일부터 드세요</span>
                    </div>
                  </section>
                );
              }

              return (
                <section key={group.key} className={cx('nowCard')}>
                  <div className={cx('nowHead')}>
                    <strong>지금 {group.label} 약</strong>
                    <span>{formatDoseTimeKorean(group.doseTime)}</span>
                  </div>
                  <ul className={cx('medList')}>
                    {group.medications.map(medication => {
                      const beforeRegistered = !medication.taken && isRegisteredAfterDose(medication, doseDate);
                      return (
                        <li key={medication.medicationId} className={cx('medicationRow', { muted: beforeRegistered })}>
                          <span>{medication.name}</span>
                          <strong>{beforeRegistered ? '내일부터' : formatDoseAmount(medication.doseAmount)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    className={cx('takeButton')}
                    disabled={isChanging || groupMedicationIds.length === 0}
                    onClick={() => {
                      setFocusedGroupKey(group.key);
                      setTaken(groupMedicationIds, true);
                    }}
                  >
                    <Icon name="check" size={28} decorative />
                    {group.label} 약 먹었어요
                  </button>
                </section>
              );
            })}
          </section>
        </>
      )}
    </section>
  );
}
