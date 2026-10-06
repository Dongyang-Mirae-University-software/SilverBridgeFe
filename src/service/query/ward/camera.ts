'use client';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  deleteWardCamera,
  getWardCameras,
  registerWardCamera,
  updateWardCamera,
} from '@/service/api/ward/camera';
import { RegisterWardCameraReq, UpdateWardCameraReq } from '@/service/interface/ward/camera';

export const wardCamerasQueryKey = ['ward-cameras'] as const;

export const wardCamerasQueryOptions = queryOptions({
  queryKey: wardCamerasQueryKey,
  queryFn: getWardCameras,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});

function useInvalidateWardCameras() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: wardCamerasQueryKey });
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
