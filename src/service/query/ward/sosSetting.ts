'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { getWardSosSetting, updateWardSosSetting } from '@/service/api/ward/sosSetting';
import { UpdateWardSosSettingReq } from '@/service/interface/ward/sosSetting';

export const wardSosSettingQueryKey = ['ward-sos-setting'] as const;

export const wardSosSettingQueryOptions = queryOptions({
  queryKey: wardSosSettingQueryKey,
  queryFn: getWardSosSetting,
  staleTime: 60 * 1000,
});

export function useUpdateWardSosSettingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['ward-sos-setting-update'],
    mutationFn: (body: UpdateWardSosSettingReq) => updateWardSosSetting(body),
    onSuccess: data => {
      if (data) queryClient.setQueryData(wardSosSettingQueryKey, data);
    },
  });
}
