'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getGuardianNotificationTypeSetting,
  updateGuardianNotificationTypeSetting,
} from '@/service/api/guardian/notification';
import { UpdateGuardianNotificationTypeSettingReq } from '@/service/interface/guardian/notification';

export const guardianNotificationTypeSettingQueryKey = ['guardian-notification-type-setting'] as const;

export const guardianNotificationTypeSettingQueryOptions = queryOptions({
  queryKey: guardianNotificationTypeSettingQueryKey,
  queryFn: getGuardianNotificationTypeSetting,
  staleTime: 60 * 1000,
});

export function useUpdateGuardianNotificationTypeSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['guardian-notification-type-setting-update'],
    mutationFn: (body: UpdateGuardianNotificationTypeSettingReq) => updateGuardianNotificationTypeSetting(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guardianNotificationTypeSettingQueryKey }),
  });
}
