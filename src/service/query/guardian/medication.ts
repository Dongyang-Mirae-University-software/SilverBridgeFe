'use client';

import { QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  addWardMedication,
  deleteGuardianMedication,
  getGuardianMedications,
  getMedicationAlertSetting,
  getMedicationSetting,
  updateGuardianMedication,
  updateMedicationAlertSetting,
  updateMedicationSetting,
} from '@/service/api/guardian/medication';
import {
  AddMedicationReq,
  UpdateMedicationAlertSettingReq,
  UpdateMedicationReq,
  UpdateMedicationSettingReq,
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

export function useAddWardMedicationMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-add'],
    mutationFn: ({ wardId, body }: { wardId: string; body: AddMedicationReq }) => addWardMedication(wardId, body),
    onSuccess: () => invalidate(),
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

export function useDeleteGuardianMedicationMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-delete'],
    mutationFn: (medicationId: number) => deleteGuardianMedication(medicationId),
    onSuccess: () => invalidate(),
  });
}

// 카드 목록(guardianMedicationQueryOptions) 응답에 alarmEnabled/remindAgainEnabled 초기값이
// 이미 포함되어 있으므로 이 조회는 설정 화면을 별도로 열 때만 필요하다
export function medicationSettingQueryOptions(wardId: string) {
  return queryOptions({
    queryKey: [...guardianMedicationQueryKey, 'setting', wardId] as const,
    queryFn: () => getMedicationSetting(wardId),
    enabled: Boolean(wardId),
  });
}

export function useUpdateMedicationSettingMutation() {
  const invalidate = useInvalidateGuardianMedication();
  return useMutation({
    mutationKey: ['guardian-medication-setting-update'],
    mutationFn: ({ wardId, body }: { wardId: string; body: UpdateMedicationSettingReq }) =>
      updateMedicationSetting(wardId, body),
    onSuccess: () => invalidate(),
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
