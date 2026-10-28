'use client';

import { useIsMutating, useMutationState, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
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
import { isRegisteredAfterDose, sortMedicationsByDoseTime } from '@/utils/format/medication';
import { WardMedicationCard } from './WardMedicationCard';
import styles from './WardMedicationContent.module.css';

const cx = classNames.bind(styles);

export function WardMedicationContent() {
  const { data, isLoading, isError, refetch } = useQuery(wardTodayMedicationQueryOptions);
  useKstMidnightRefetch(wardTodayMedicationQueryKey);

  const doseDate = data?.doseDate ?? '';
  const medications = sortMedicationsByDoseTime(data?.medications ?? []);
  // 오늘 복용 시각이 지난 뒤 등록된 약은 그날 체크 대상이 아니다.
  const isBeforeRegistered = (medication: MedicationItem) =>
    !medication.taken && isRegisteredAfterDose(medication, doseDate);
  const actionableMedications = medications.filter(medication => !isBeforeRegistered(medication));
  const isAllTaken = actionableMedications.length > 0 && actionableMedications.every(medication => medication.taken);

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
  const setTaken = (medicationId: number, taken: boolean) => {
    if (sendingRef.current || isChanging) return;
    sendingRef.current = true;
    batchMutation.mutate(
      { medicationIds: [medicationId], taken },
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

          <ul className={cx('medicationList')} aria-label="오늘 드실 약">
            {medications.map(medication => (
              <WardMedicationCard
                key={medication.medicationId}
                medication={medication}
                beforeRegistered={isBeforeRegistered(medication)}
                disabled={isChanging}
                onTake={taken => setTaken(medication.medicationId, taken)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
