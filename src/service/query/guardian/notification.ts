'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getGuardianNotificationTypeSetting,
  updateGuardianNotificationTypeSetting,
} from '@/service/api/guardian/notification';
import {
  GuardianNotificationTypeSetting,
  UpdateGuardianNotificationTypeSettingReq,
} from '@/service/interface/guardian/notification';

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
    // 누른 즉시 화면에 반영하고, 저장에 실패하면 이전 값으로 되돌린다
    onMutate: async body => {
      await queryClient.cancelQueries({ queryKey: guardianNotificationTypeSettingQueryKey });
      const previous = queryClient.getQueryData<GuardianNotificationTypeSetting>(guardianNotificationTypeSettingQueryKey);
      if (previous) {
        const next = { ...previous };
        (Object.keys(body) as Array<keyof UpdateGuardianNotificationTypeSettingReq>).forEach(key => {
          const enabled = body[key];
          if (typeof enabled === 'boolean') next[key] = { required: false, ...previous[key], enabled };
        });
        queryClient.setQueryData(guardianNotificationTypeSettingQueryKey, next);
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(guardianNotificationTypeSettingQueryKey, context.previous);
    },
    onSuccess: data => {
      if (data) queryClient.setQueryData(guardianNotificationTypeSettingQueryKey, data);
    },
  });
}
