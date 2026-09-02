import { queryOptions } from '@tanstack/react-query';

import { getGuardianSosHistory, GetGuardianSosHistoryParams } from '@/service/api/guardian/sosHistory';

export function guardianSosHistoryQueryOptions(params: GetGuardianSosHistoryParams = {}) {
  return queryOptions({
    queryKey: ['guardian-sos-history', params] as const,
    queryFn: () => getGuardianSosHistory(params),
    staleTime: 10 * 1000,
  });
}
