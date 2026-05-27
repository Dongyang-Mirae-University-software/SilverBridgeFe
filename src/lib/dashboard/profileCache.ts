import { QueryClient } from '@tanstack/react-query';

import { CommonResponse } from '@/service/interface/common';
import { IUserProfile } from '@/service/interface/user';
import { myProfileQueryKey } from '@/service/query/user';
import { getUserProfileData } from '@/lib/auth/userProfile';

export function setMyProfileCache(queryClient: QueryClient, response: unknown) {
  const profile = getUserProfileData(response);
  if (!profile) return null;

  queryClient.setQueryData<CommonResponse<IUserProfile>>(myProfileQueryKey, {
    code: 200,
    message: 'OK',
    success: true,
    data: profile,
  });

  return profile;
}

export function updateMyProfileCache(queryClient: QueryClient, updater: (profile: IUserProfile) => IUserProfile) {
  queryClient.setQueryData<CommonResponse<IUserProfile>>(myProfileQueryKey, current => {
    const profile = getUserProfileData(current);
    if (!profile) return current;

    return {
      ...(current ?? { code: 200, message: 'OK', success: true }),
      data: updater(profile),
    };
  });
}
