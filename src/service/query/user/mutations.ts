'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { changeMyProfileImage, deleteMyProfileImage } from '@/service/api/user';
import { myProfileQueryKey } from './profile';
import { reportNonApiError } from '@/lib/api/reportError';
import { setMyProfileCache, updateMyProfileCache } from '@/lib/dashboard/profileCache';

export function useProfileImageChangeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user-profile-image-change'],
    mutationFn: changeMyProfileImage,
    onSuccess: response => {
      setMyProfileCache(queryClient, response);
      void queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
    },
    onError: error => reportNonApiError('프로필 이미지 변경 실패:', error),
  });
}

export function useProfileImageDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['user-profile-image-delete'],
    mutationFn: deleteMyProfileImage,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: myProfileQueryKey });
      const previousProfile = queryClient.getQueryData(myProfileQueryKey);
      updateMyProfileCache(queryClient, profile => ({ ...profile, profileImage: null }));

      return { previousProfile };
    },
    onError: (error, _variables, context) => {
      if (context?.previousProfile) queryClient.setQueryData(myProfileQueryKey, context.previousProfile);
      reportNonApiError('프로필 이미지 삭제 실패:', error);
    },
    onSuccess: () => {
      updateMyProfileCache(queryClient, current => ({ ...current, profileImage: null }));
    },
  });
}
