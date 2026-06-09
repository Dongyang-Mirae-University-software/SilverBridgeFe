'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getMyNotificationSettings,
  updateMyNotificationSettings,
} from '@/service/api/user';
import type { CommonResponse } from '@/service/interface/common';
import type {
  IUserNotificationSetting,
  IUserNotificationSettingsResponse,
  IUserNotificationSettingsUpdateReq,
  NotificationChannelType,
} from '@/service/interface/user';
import { reportNonApiError } from '@/lib/api/reportError';

export const userNotificationSettingsQueryKey = ['user-notification-settings'] as const;

const NOTIFICATION_CHANNELS: NotificationChannelType[] = ['FCM', 'SMS', 'KAKAO_ALIMTALK', 'EMAIL'];

function normalizeNotificationSettings(settings: IUserNotificationSetting[] | undefined) {
  const map = new Map(settings?.map(item => [item.channelType, item.enabled]) ?? []);

  return NOTIFICATION_CHANNELS.map(channelType => ({
    channelType,
    enabled: map.get(channelType) ?? (channelType === 'FCM'),
  }));
}

export function getNormalizedNotificationSettings(response: IUserNotificationSettingsResponse | undefined) {
  return normalizeNotificationSettings(response?.settings);
}

function getNotificationSettingsBody(response: unknown) {
  const body = response as
    | CommonResponse<IUserNotificationSettingsResponse>
    | { data?: CommonResponse<IUserNotificationSettingsResponse> | IUserNotificationSettingsResponse };
  const data = body?.data as CommonResponse<IUserNotificationSettingsResponse> | IUserNotificationSettingsResponse | undefined;

  if (data && typeof data === 'object' && 'settings' in data) {
    return data as IUserNotificationSettingsResponse;
  }

  return (data as CommonResponse<IUserNotificationSettingsResponse> | undefined)?.data ?? null;
}

export const userNotificationSettingsQueryOptions = queryOptions({
  queryKey: userNotificationSettingsQueryKey,
  queryFn: async (): Promise<IUserNotificationSetting[]> => {
    const response = await getMyNotificationSettings();
    return normalizeNotificationSettings(getNotificationSettingsBody(response)?.settings);
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: false,
});

export function useNotificationSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user-notification-settings-update'],
    mutationFn: (body: IUserNotificationSettingsUpdateReq) => updateMyNotificationSettings(body),
    onMutate: async variables => {
      await queryClient.cancelQueries({ queryKey: userNotificationSettingsQueryKey });
      const previous = queryClient.getQueryData<IUserNotificationSetting[]>(userNotificationSettingsQueryKey) ?? [];

      queryClient.setQueryData(
        userNotificationSettingsQueryKey,
        normalizeNotificationSettings([...previous, ...variables.settings]),
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(userNotificationSettingsQueryKey, context.previous);
      reportNonApiError('알림 설정 변경 실패:', error);
    },
    onSuccess: response => {
      queryClient.setQueryData(
        userNotificationSettingsQueryKey,
        normalizeNotificationSettings(getNotificationSettingsBody(response)?.settings),
      );
    },
  });
}
