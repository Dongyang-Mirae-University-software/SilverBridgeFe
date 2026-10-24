'use client';

import { useIsMutating, useMutationState, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
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
import { formatDoseTimeKorean, groupMedicationsByTime, isRegisteredAfterDose } from '@/utils/format/medication';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

// 시간대 상태: todo 먹을 약이 남음 / done 다 먹음 / skipped 오늘 등록 전이라 그날 먹을 약이 없음
type SlotState = 'todo' | 'done' | 'skipped';

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const doseDate = data?.doseDate ?? '';
  const medications = data?.medications ?? [];
  // 2026-10-24 디자인: 시간대 하나만 크게 펼치고 나머지는 한 줄. 체크·되돌리기는 시간대 단위(묶음 API)로만 한다
  const slots = groupMedicationsByTime(medications, '00:00', doseDate).map(group => {
    // 오늘 복용 시각이 지난 뒤 등록된 약은 그날 체크 대상이 아니다(BE 미복용 요약·보호자 카드와 같은 기준)
    const isSkipped = (medication: MedicationItem) => !medication.taken && isRegisteredAfterDose(medication, doseDate);
    const counted = group.medications.filter(medication => !isSkipped(medication));
    const untaken = counted.filter(medication => !medication.taken);
    const state: SlotState = counted.length === 0 ? 'skipped' : untaken.length === 0 ? 'done' : 'todo';
    return { ...group, isSkipped, counted, untaken, state };
  });
  const nowSlot = slots.find(slot => slot.state === 'todo');
  const isAllTaken = slots.some(slot => slot.state === 'done') && !nowSlot;

  // 펼칠 시간대: 누른 것, 없으면 지금 먹을 시간대. 체크한 시간대는 그대로 펼쳐 두어 바로 되돌릴 수 있게 한다
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const focused = slots.find(slot => slot.key === focusKey) ?? (isAllTaken ? undefined : nowSlot);

  const batchMutation = useMedicationIntakeBatchMutation();
  // 처리 중이면 모든 버튼을 잠근다 - 연속 탭으로 같은 요청이 두 번 가지 않게
  const isChanging = useIsMutating({ mutationKey: ['ward-medication-intake'] }) > 0;
  // 가장 최근 체크가 실패했으면 안내한다(점검 M-1)
  const intakeStatuses = useMutationState({
    filters: { mutationKey: ['ward-medication-intake'] },
    select: mutation => mutation.state.status,
  });
  const lastIntakeFailed = intakeStatuses.at(-1) === 'error';

  // isChanging은 다음 렌더에야 바뀌어 아주 빠른 두 번째 탭은 못 막는다 - 누른 즉시 잠그는 ref를 함께 쓴다
  const sendingRef = useRef(false);
  const setTaken = (key: string, medicationIds: number[], taken: boolean) => {
    if (sendingRef.current || isChanging || medicationIds.length === 0) return;
    sendingRef.current = true;
    setFocusKey(key);
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
          {isAllTaken && !focused && (
            <section className={cx('allTaken')}>
              <Icon name="check" size={30} decorative />
              오늘 약 다 먹었어요
            </section>
          )}

          {lastIntakeFailed && (
            <p className={cx('intakeError')} role="alert">
              체크하지 못했어요. 목록을 다시 불러왔으니 한 번 더 눌러 주세요
            </p>
          )}

          <div className={cx('slots')}>
            {slots.map(slot => {
              const time = formatDoseTimeKorean(slot.doseTime);
              if (slot.key !== focused?.key) {
                return (
                  <section key={slot.key} aria-label={`${slot.label} 약`}>
                    <button
                      type="button"
                      className={cx('slotRow', { done: slot.state !== 'todo' })}
                      aria-expanded={false}
                      onClick={() => setFocusKey(slot.key)}
                    >
                      <span className={cx('slotName')}>{slot.label} 약</span>
                      {slot.state === 'done' ? (
                        <span className={cx('slotDone')}>
                          <Icon name="check" size={22} decorative />
                          먹었어요
                        </span>
                      ) : slot.state === 'skipped' ? (
                        <span className={cx('slotTime')}>오늘은 등록 전</span>
                      ) : (
                        <span className={cx('slotTime')}>{time}</span>
                      )}
                    </button>
                  </section>
                );
              }

              if (slot.state === 'done') {
                const takenIds = slot.medications.filter(m => m.taken).map(m => m.medicationId);
                return (
                  <section key={slot.key} className={cx('doneCard')} aria-label={`${slot.label} 약`}>
                    <span className={cx('doneIcon')}>
                      <Icon name="check" size={34} color="#fff" decorative />
                    </span>
                    <strong className={cx('doneText')}>{slot.label} 약 다 먹었어요</strong>
                    <button
                      type="button"
                      className={cx('undoButton')}
                      disabled={isChanging}
                      aria-label={`${slot.label} 약 되돌리기`}
                      onClick={() => setTaken(slot.key, takenIds, false)}
                    >
                      되돌리기
                    </button>
                  </section>
                );
              }

              const partial = slot.untaken.length > 0 && slot.untaken.length < slot.counted.length;
              return (
                <section key={slot.key} className={cx('nowCard')} aria-label={`${slot.label} 약`}>
                  <header className={cx('nowHead')}>
                    <strong>{slot.key === nowSlot?.key ? `지금 ${slot.label} 약` : `${slot.label} 약`}</strong>
                    <span>{time}</span>
                  </header>
                  <ul className={cx('medList')}>
                    {slot.medications.map(medication => (
                      <WardMedicationCard
                        key={medication.medicationId}
                        medication={medication}
                        beforeRegistered={slot.isSkipped(medication)}
                      />
                    ))}
                  </ul>
                  {slot.state === 'skipped' ? (
                    <p className={cx('skippedText')}>오늘 드실 시간이 지난 뒤 등록된 약이에요. 내일부터 드세요</p>
                  ) : (
                    <button
                      type="button"
                      className={cx('takeButton')}
                      disabled={isChanging}
                      onClick={() =>
                        setTaken(
                          slot.key,
                          slot.untaken.map(medication => medication.medicationId),
                          true,
                        )
                      }
                    >
                      <Icon name="check" size={28} color="#fff" decorative />
                      {partial ? `남은 약 ${slot.untaken.length}개 먹었어요` : `${slot.label} 약 먹었어요`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
