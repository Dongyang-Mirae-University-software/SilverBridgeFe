import { queryOptions } from '@tanstack/react-query';

import { getGuardianCameras } from '@/service/api/guardian/camera';

export const guardianCamerasQueryKey = ['guardian-cameras'] as const;

export const guardianCamerasQueryOptions = queryOptions({
  queryKey: guardianCamerasQueryKey,
  queryFn: getGuardianCameras,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  staleTime: 10 * 1000,
  retry: false,
});
