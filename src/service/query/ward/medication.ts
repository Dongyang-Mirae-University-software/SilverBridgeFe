'use client';

import { QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  checkMedicationIntake,
  getTodayMedication,
  setMedicationIntakeBatch,
  uncheckMedicationIntake,
} from '@/service/api/ward/medication';
import { reportNonApiError } from '@/lib/api/reportError';
import { MedicationItem, TodayMedicationResponse } from '@/service/interface/medication';

export const wardTodayMedicationQueryKey = ['ward-today-medication'] as const;

export const wardTodayMedicationQueryOptions = queryOptions({
  queryKey: wardTodayMedicationQueryKey,
  queryFn: getTodayMedication,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

function replaceMedicationInCache(queryClient: ReturnType<typeof useQueryClient>, item: MedicationItem | null) {
  if (!item) return;
  replaceMedicationsInCache(queryClient, [item]);
}

function replaceMedicationsInCache(queryClient: ReturnType<typeof useQueryClient>, items: MedicationItem[]) {
  const byId = new Map(items.filter(Boolean).map(item => [item.medicationId, item]));
  if (byId.size === 0) return;
  queryClient.setQueryData<TodayMedicationResponse>(wardTodayMedicationQueryKey, current => {
    if (!current) return current;
    const medications = current.medications.map(medication => byId.get(medication.medicationId) ?? medication);
    return {
      ...current,
      medications,
      takenCount: medications.filter(medication => medication.taken).length,
    };
  });
}

// WS medication-taken 이벤트(다른 기기·탭에서 체크한 경우)로 목록을 그 자리에서 갱신
export function applyMedicationTakenToWardCache(
  queryClient: QueryClient,
  payload: { medicationId?: string; taken?: string; takenAt?: string },
) {
  const medicationId = Number(payload.medicationId);
  if (!Number.isFinite(medicationId)) return;

  queryClient.setQueryData<TodayMedicationResponse>(wardTodayMedicationQueryKey, current => {
    if (!current) return current;
    const medications = current.medications.map(medication =>
      medication.medicationId === medicationId
        ? { ...medication, taken: payload.taken === 'true', takenAt: payload.takenAt ?? null }
        : medication,
    );
    return { ...current, medications, takenCount: medications.filter(medication => medication.taken).length };
  });
}

// 체크/해제 응답은 갱신된 항목 1건이라 목록 재조회 없이 그 자리에서 교체한다(멱등 — 더블 탭해도 에러 아님)
export function useMedicationIntakeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ward-medication-intake'],
    mutationFn: ({ medicationId, taken }: { medicationId: number; taken: boolean }) =>
      taken ? checkMedicationIntake(medicationId) : uncheckMedicationIntake(medicationId),
    onSuccess: item => replaceMedicationInCache(queryClient, item),
    onError: error => reportNonApiError('복용 체크 변경 실패:', error),
  });
}

// "아침 약 다 먹었어요" - 그 시간대에서 아직 체크하지 않은 약을 한 번에 체크한다(BE 한 트랜잭션)
export function useMedicationIntakeBatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ward-medication-intake'],
    mutationFn: ({ medicationIds, taken }: { medicationIds: number[]; taken: boolean }) =>
      setMedicationIntakeBatch(medicationIds, taken),
    onSuccess: items => replaceMedicationsInCache(queryClient, items ?? []),
    onError: error => reportNonApiError('복용 묶음 체크 실패:', error),
  });
}
