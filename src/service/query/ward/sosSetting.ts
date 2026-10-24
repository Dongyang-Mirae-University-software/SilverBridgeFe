'use client';

import { QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { getWardSosSetting, updateWardSosSetting } from '@/service/api/ward/sosSetting';
import { UpdateWardSosSettingReq } from '@/service/interface/ward/sosSetting';

export const wardSosSettingQueryKey = ['ward-sos-setting'] as const;
export const wardSosSettingUpdateMutationKey = ['ward-sos-setting-update'] as const;

export const wardSosSettingQueryOptions = queryOptions({
  queryKey: wardSosSettingQueryKey,
  queryFn: getWardSosSetting,
  staleTime: 60 * 1000,
});

// 첫 서버 응답보다 사용자가 먼저 SOS 동작 저장을 시작했는지(진행 중·성공).
// 그랬다면 레이아웃의 첫 동기화가 늦게 온 옛 값으로 화면을 덮으면 안 된다. 실패한 저장은 화면이 이미 되돌아가 있어 세지 않는다
export function hasUserSavedWardSosSetting(queryClient: QueryClient) {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: wardSosSettingUpdateMutationKey })
    .some(mutation => mutation.state.status === 'pending' || mutation.state.status === 'success');
}

export function useUpdateWardSosSettingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: wardSosSettingUpdateMutationKey,
    mutationFn: (body: UpdateWardSosSettingReq) => updateWardSosSetting(body),
    onSuccess: data => {
      if (data) queryClient.setQueryData(wardSosSettingQueryKey, data);
    },
  });
}
