import { queryOptions } from '@tanstack/react-query';

import { getGuardianSosHistory, getGuardianSosHistoryData, GetGuardianSosHistoryParams } from '@/service/api/guardian/sos';

export function guardianSosHistoryQueryOptions(params: GetGuardianSosHistoryParams = {}) {
  return queryOptions({
    queryKey: ['guardian-sos-history', params] as const,
    queryFn: async () => {
      const response = await getGuardianSosHistory(params);
      return getGuardianSosHistoryData(response);
    },
    staleTime: 10 * 1000,
  });
}
