import { queryOptions } from '@tanstack/react-query';

import { getGuardianSosHistory, GetGuardianSosHistoryParams } from '@/service/api/guardian/sosHistory';

export const guardianSosHistoryQueryKey = ['guardian-sos-history'] as const;

export function guardianSosHistoryQueryOptions(params: GetGuardianSosHistoryParams = {}) {
  return queryOptions({
    queryKey: [...guardianSosHistoryQueryKey, params] as const,
    queryFn: () => getGuardianSosHistory(params),
    staleTime: 10 * 1000,
  });
}
