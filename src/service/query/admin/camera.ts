import { queryOptions } from '@tanstack/react-query';

import { getAdminCameras, getAdminCameraSummary } from '@/service/api/admin/camera';
import { AdminCameraListParams } from '@/service/interface/admin/camera';

export const adminCameraQueryKey = ['admin-camera'] as const;

export const adminCameraListQueryOptions = (params: AdminCameraListParams) => queryOptions({
  queryKey: [...adminCameraQueryKey, 'list', params] as const,
  queryFn: () => getAdminCameras(params),
  staleTime: 15_000,
});

export const adminCameraSummaryQueryOptions = queryOptions({
  queryKey: [...adminCameraQueryKey, 'summary'] as const,
  queryFn: getAdminCameraSummary,
  staleTime: 15_000,
});
