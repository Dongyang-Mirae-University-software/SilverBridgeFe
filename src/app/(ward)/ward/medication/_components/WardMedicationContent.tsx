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
import { useKstNow } from '@/utils/reservation/useKstNow';
import {
  formatDoseAmount,
  formatDoseTime,
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

// 약 개수에 따라 칸 수·글자 크기를 고른다(디자인 시안 기준: 3개까지 1칸, 8개까지 2칸, 그 이상 3칸)
function getMedGridSize(count: number) {
  if (count <= 3) return 'few';
  if (count === 4) return 'four';
  if (count <= 6) return 'some';
  if (count <= 8) return 'many';
  return 'lots';
}

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
  // 디자인 시안: 늘 한 시간대를 크게 보여 준다 - 고른 시간대, 없으면 아직 안 끝난 첫 시간대, 다 끝났으면 첫 시간대
  const selectedGroup = focusedGroup ?? firstIncompleteGroup ?? medicationGroups[0] ?? null;
  const selectedGroupMedicationIds = selectedGroup?.actionableMedications.map(medication => medication.medicationId) ?? [];

  // 복용 시각이 지났는데 체크하지 않은 시간대 - 오늘 목록일 때만 센다(자정 직후 다시 불러오기 전에는 표시하지 않는다)
  const { today: kstToday, nowTime } = useKstNow();
  const isLate = (group: MedicationGroup) =>
    !group.isTaken && !group.isBeforeRegistered && doseDate === kstToday && formatDoseTime(group.doseTime) < nowTime;
  // 안 드셨다고 단정하지 않는다 - '체크' 기준으로 말한다
  const getGroupTag = (group: MedicationGroup) => {
    if (group.isTaken) return '먹었어요';
    if (group.isBeforeRegistered) return '내일부터';
    if (isLate(group)) return '체크 안 했어요';
    if (group.key === firstIncompleteGroup?.key) return '지금';
    return formatDoseTimeKorean(group.doseTime);
  };
  const getLeadText = (group: MedicationGroup) => {
    if (group.isTaken) return '다 먹었어요';
    if (group.isBeforeRegistered) return '오늘 늦게 등록한 약';
    if (group.key === firstIncompleteGroup?.key) return '지금 먹을 약';
    if (isLate(group)) return '체크되지 않은 약';
    return '다음에 먹을 약';
  };

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

          <section className={cx('tabs')} aria-label="오늘 먹을 약 시간대">
            {medicationGroups.map(group => {
              const isSelected = selectedGroup?.key === group.key;
              const tag = getGroupTag(group);
              return (
                <button
                  key={group.key}
                  type="button"
                  className={cx('tab', { selected: isSelected, done: group.isTaken })}
                  aria-pressed={isSelected}
                  aria-label={`${group.label} 약, ${tag}`}
                  onClick={() => setFocusedGroupKey(group.key)}
                >
                  <span className={cx('tabName')}>{group.label}</span>
                  <span
                    className={cx('tabTag', {
                      tagDone: group.isTaken,
                      tagLate: !group.isTaken && isLate(group),
                      tagNow: !group.isTaken && !isLate(group) && group.key === firstIncompleteGroup?.key,
                    })}
                  >
                    {group.isTaken && <Icon name="check" size={18} decorative />}
                    {tag}
                  </span>
                </button>
              );
            })}
          </section>

          {selectedGroup && (
            <section className={cx('slotCard', { done: selectedGroup.isTaken })} aria-label={`${selectedGroup.label} 약`}>
              <div className={cx('lead')}>
                <span className={cx('leadState')}>{getLeadText(selectedGroup)}</span>
                <strong className={cx('leadName')}>{selectedGroup.label}</strong>
                <span className={cx('leadTime')}>{formatDoseTimeKorean(selectedGroup.doseTime)}</span>
              </div>
              <div className={cx('body')}>
                <ul className={cx('medGrid', getMedGridSize(selectedGroup.medications.length))}>
                  {selectedGroup.medications.map(medication => {
                    const beforeRegistered = !medication.taken && isRegisteredAfterDose(medication, doseDate);
                    return (
                      <li key={medication.medicationId} className={cx('medCell', { muted: beforeRegistered })}>
                        <span className={cx('medName')}>{medication.name}</span>
                        <strong className={cx('medAmount')}>
                          {beforeRegistered ? '내일부터' : formatDoseAmount(medication.doseAmount)}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
                {selectedGroup.isTaken ? (
                  <button
                    type="button"
                    className={cx('undoButton')}
                    disabled={isChanging}
                    aria-label={`${selectedGroup.label} 약 복용 체크 되돌리기`}
                    onClick={() => {
                      setFocusedGroupKey(selectedGroup.key);
                      setTaken(selectedGroupMedicationIds, false);
                    }}
                  >
                    잘못 눌렀어요
                  </button>
                ) : selectedGroup.isBeforeRegistered ? (
                  <p className={cx('beforeText')}>내일부터 드세요</p>
                ) : (
                  <button
                    type="button"
                    className={cx('takeButton')}
                    disabled={isChanging || selectedGroupMedicationIds.length === 0}
                    onClick={() => {
                      // 체크한 시간대에 그대로 머문다 - 바로 '잘못 눌렀어요'를 누를 수 있게(점검 cc859c0 펼침 고정)
                      setFocusedGroupKey(selectedGroup.key);
                      setTaken(selectedGroupMedicationIds, true);
                    }}
                  >
                    <Icon name="check" size={32} decorative />
                    {selectedGroup.label} 약 먹었어요
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
