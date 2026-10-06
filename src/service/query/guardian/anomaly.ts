'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getAnomalyReminderSetting,
  getGuardianAnomalyClips,
  getGuardianAnomalyHistory,
  submitAnomalyFeedback,
  updateAnomalyReminderSetting,
} from '@/service/api/guardian/anomaly';
import {
  AnomalyFeedbackReq,
  GetAnomalyHistoryParams,
  UpdateAnomalyReminderSettingReq,
} from '@/service/interface/guardian/anomaly';

export const guardianAnomalyHistoryQueryKey = ['guardian-anomaly-history'] as const;
export const guardianAnomalyReminderSettingQueryKey = ['guardian-anomaly-reminder-setting'] as const;
export const guardianAnomalyClipsQueryKey = ['guardian-anomaly-clips'] as const;

export function guardianAnomalyHistoryQueryOptions(params: GetAnomalyHistoryParams = {}) {
  return queryOptions({
    queryKey: [...guardianAnomalyHistoryQueryKey, params] as const,
    queryFn: () => getGuardianAnomalyHistory(params),
    staleTime: 10 * 1000,
  });
}

export const guardianAnomalyReminderSettingQueryOptions = queryOptions({
  queryKey: guardianAnomalyReminderSettingQueryKey,
  queryFn: getAnomalyReminderSetting,
  staleTime: 60 * 1000,
});

export function guardianAnomalyClipsQueryOptions(incidentId: number) {
  return queryOptions({
    queryKey: [...guardianAnomalyClipsQueryKey, incidentId] as const,
    queryFn: () => getGuardianAnomalyClips(incidentId),
    staleTime: 10 * 1000,
  });
}

export function useAnomalyFeedbackMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['guardian-anomaly-feedback'],
    mutationFn: ({ incidentId, body }: { incidentId: number; body: AnomalyFeedbackReq }) =>
      submitAnomalyFeedback(incidentId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: guardianAnomalyHistoryQueryKey });
      queryClient.invalidateQueries({ queryKey: [...guardianAnomalyClipsQueryKey, variables.incidentId] });
    },
  });
}

export function useUpdateAnomalyReminderSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['guardian-anomaly-reminder-setting-update'],
    mutationFn: (body: UpdateAnomalyReminderSettingReq) => updateAnomalyReminderSetting(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guardianAnomalyReminderSettingQueryKey }),
  });
}
