'use client';

import { QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  addWardMedicationBatch,
  deleteGuardianMedication,
  deleteWardMedicationBatch,
  getGuardianMedications,
  getMedicationAlertSetting,
  updateGuardianMedication,
  updateMedicationAlertSetting,
} from '@/service/api/guardian/medication';
import {
  AddMedicationBatchReq,
  UpdateMedicationAlertSettingReq,
  UpdateMedicationReq,
  WardMedicationSummary,
} from '@/service/interface/medication';

export const guardianMedicationQueryKey = ['guardian-medication'] as const;

export const guardianMedicationQueryOptions = queryOptions({
  queryKey: guardianMedicationQueryKey,
  queryFn: getGuardianMedications,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

// WS medication-taken 이벤트로 카드 목록을 그 자리에서 갱신(재조회 없이). 카운트는 medications에서 다시 계산
export function applyMedicationTakenToGuardianCache(
  queryClient: QueryClient,
  payload: { wardId?: string; medicationId?: string; taken?: string; takenAt?: string },
) {
  const medicationId = Number(payload.medicationId);
  if (!payload.wardId || !Number.isFinite(medicationId)) return;

  queryClient.setQueryData<WardMedicationSummary[]>(guardianMedicationQueryKey, current => {
    if (!current) return current;
    return current.map(summary => {
      if (summary.wardId !== payload.wardId) return summary;
      const medications = summary.medications.map(medication =>
        medication.medicationId === medicationId
          ? { ...medication, taken: payload.taken === 'true', takenAt: payload.takenAt ?? null }
          : medication,
      );
      return { ...summary, medications, takenCount: medications.filter(medication => medication.taken).length };
    });
  });
}

function useInvalidateGuardianMedication() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: guardianMedicationQueryKey });
}

export function useAddWardMedicationBatchMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-add-batch'],
    mutationFn: ({ wardId, body }: { wardId: string; body: AddMedicationBatchReq }) =>
      addWardMedicationBatch(wardId, body),
    // 실패해도 새로고침한다 - 응답 전에 끊긴 요청은 서버에 등록됐을 수 있다(약 추가 모달이 목록에서 확인하라고 안내)
    onSettled: () => invalidate(),
  });
}

export function useUpdateGuardianMedicationMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-update'],
    mutationFn: ({ medicationId, body }: { medicationId: number; body: UpdateMedicationReq }) =>
      updateGuardianMedication(medicationId, body),
    onSuccess: () => invalidate(),
  });
}

// 실패해도 목록을 다시 불러온다 - 다른 보호자가 그 사이 바꿨다면 바뀐 목록에서 다시 고를 수 있게
export function useDeleteWardMedicationBatchMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-delete'],
    mutationFn: ({ wardId, medicationIds }: { wardId: string; medicationIds: number[] }) =>
      deleteWardMedicationBatch(wardId, medicationIds),
    onSettled: () => invalidate(),
  });
}

export function useDeleteGuardianMedicationMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-delete'],
    mutationFn: (medicationId: number) => deleteGuardianMedication(medicationId),
    // 실패해도 다시 불러온다 - 다른 보호자가 그 사이 지웠다면 목록에서 빠진다(여러 개 삭제와 같게, 점검 L-2)
    onSettled: () => invalidate(),
  });
}

export function medicationAlertSettingQueryOptions(wardId: string) {
  return queryOptions({
    queryKey: [...guardianMedicationQueryKey, 'alert-setting', wardId] as const,
    queryFn: () => getMedicationAlertSetting(wardId),
    enabled: Boolean(wardId),
  });
}

export function useUpdateMedicationAlertSettingMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-alert-setting-update'],
    mutationFn: ({ wardId, body }: { wardId: string; body: UpdateMedicationAlertSettingReq }) =>
      updateMedicationAlertSetting(wardId, body),
    onSuccess: () => invalidate(),
  });
}
