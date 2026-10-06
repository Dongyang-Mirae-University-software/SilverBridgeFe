'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  deleteWardCamera,
  getWardCameraRooms,
  getWardCameras,
  getWardLiveCameras,
  registerWardCamera,
  updateWardCamera,
} from '@/service/api/ward/camera';
import { RegisterWardCameraReq, UpdateWardCameraReq } from '@/service/interface/ward/camera';

export const wardCamerasQueryKey = ['ward-cameras'] as const;
export const wardCameraRoomsQueryKey = ['ward-camera-rooms'] as const;
export const wardLiveCamerasQueryKey = ['ward-live-cameras'] as const;

export const wardCamerasQueryOptions = queryOptions({
  queryKey: wardCamerasQueryKey,
  queryFn: getWardCameras,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

export const wardCameraRoomsQueryOptions = queryOptions({
  queryKey: wardCameraRoomsQueryKey,
  queryFn: getWardCameraRooms,
  staleTime: 5 * 1000,
  retry: false,
});

// 연결 상태 폴링은 15초 이상 간격 — 더 자주 부르면 429
export const wardLiveCamerasQueryOptions = queryOptions({
  queryKey: wardLiveCamerasQueryKey,
  queryFn: getWardLiveCameras,
  refetchInterval: 15 * 1000,
  staleTime: 10 * 1000,
  retry: false,
});

function useInvalidateWardCameras() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: wardCamerasQueryKey }),
      queryClient.invalidateQueries({ queryKey: wardCameraRoomsQueryKey }),
      queryClient.invalidateQueries({ queryKey: wardLiveCamerasQueryKey }),
    ]);
}

export function useRegisterWardCameraMutation() {
  const invalidate = useInvalidateWardCameras();
  return useMutation({
    mutationKey: ['ward-camera-register'],
    mutationFn: (body: RegisterWardCameraReq) => registerWardCamera(body),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateWardCameraMutation() {
  const invalidate = useInvalidateWardCameras();
  return useMutation({
    mutationKey: ['ward-camera-update'],
    mutationFn: ({ id, body }: { id: number; body: UpdateWardCameraReq }) => updateWardCamera(id, body),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteWardCameraMutation() {
  const invalidate = useInvalidateWardCameras();
  return useMutation({
    mutationKey: ['ward-camera-delete'],
    mutationFn: (id: number) => deleteWardCamera(id),
    onSuccess: () => invalidate(),
  });
}
