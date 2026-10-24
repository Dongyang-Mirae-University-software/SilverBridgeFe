'use client';

import { useIsMutating, useMutationState, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
  // 펼침: 기본은 지금 먹을 시간대 하나만(다 먹은·나중 시간대는 머리만) - 핸드폰에서 18줄이 한꺼번에 보였다(2026-10-24).
  // 머리를 누르면 그 시간대만 펼치고 접는다(잘못 누른 약을 풀 때도)
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => toggled[key] ?? key === nextGroup?.key;
  const toggleGroup = (key: string) => setToggled(current => ({ ...current, [key]: !isOpen(key) }));
  const batchMutation = useMedicationIntakeBatchMutation();
  // 약 하나 체크와 묶음 체크가 겹치지 않게 둘 중 하나라도 처리 중이면 모든 체크 버튼을 잠근다
  const isChanging = useIsMutating({ mutationKey: ['ward-medication-intake'] }) > 0;
  // 가장 최근 체크(묶음·단건)가 실패했으면 안내한다 - 전에는 실패해도 화면에 아무 반응이 없었다(점검 M-1)
  const intakeStatuses = useMutationState({
    filters: { mutationKey: ['ward-medication-intake'] },
    select: mutation => mutation.state.status,
  });
  const lastIntakeFailed = intakeStatuses.at(-1) === 'error';
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
                    {/* 일부를 먹었으면 남은 수라고 밝힌다 - 아래 묶음 머리 "약 6개"와 숫자가 달라 보였다(점검 L-1) */}
                    <strong>
                      {nextUntaken.length < nextGroup.medications.length ? '남은 약' : '약'} {nextUntaken.length}개
                    </strong>
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

          {lastIntakeFailed && (
            <p className={cx('intakeError')} role="alert">
              체크하지 못했어요. 목록을 다시 불러왔으니 한 번 더 눌러 주세요
            </p>
          )}

          {groups.map(group => {
            const untaken = group.medications.filter(medication => !medication.taken);
            const open = isOpen(group.key);
            const panelId = `ward-medication-group-${group.key}`;
            return (
              <section key={group.key} className={cx('listCard')} aria-label={`${group.label} 약`}>
                <header className={cx('groupHeader')}>
                  <button
                    type="button"
                    className={cx('groupToggle')}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className={cx('groupTitle')}>
                      <strong>{getMedicationTimeSlotLabel(group.timeSlot)}</strong>
                      <span>
                        {formatDoseTime(group.doseTime)} · 약 {group.medications.length}개
                      </span>
                    </span>
                    <span className={cx('chevron', { open })} aria-hidden="true">
                      ›
                    </span>
                  </button>
                  {untaken.length === 0 ? (
                    <span className={cx('groupDone')}>
                      <Icon name="check" size={20} decorative />다 드셨어요
                    </span>
                  ) : (
                    // 지금 먹을 시간대는 위 카드에 같은 버튼이 있어 두지 않는다
                    group.medications.length > 1 &&
                    group.key !== nextGroup?.key && (
                      <button
                        type="button"
                        className={cx('groupButton')}
                        disabled={isChanging}
                        aria-label={`${group.label} 약 다 먹었어요`}
                        onClick={() =>
                          batchMutation.mutate({ medicationIds: untaken.map(medication => medication.medicationId), taken: true })
                        }
                      >
                        다 먹었어요
                      </button>
                    )
                  )}
                </header>
                {open && (
                  <ul id={panelId} className={cx('list')}>
                    {group.medications.map(medication => (
                      <WardMedicationCard key={medication.medicationId} medication={medication} disabled={isChanging} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <p className={cx('toggleHint')}>잘못 눌렀다면 그 약의 버튼을 한 번 더 누르세요</p>
        </>
      )}
    </section>
  );
}
