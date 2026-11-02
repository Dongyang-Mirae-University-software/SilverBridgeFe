import { queryOptions } from '@tanstack/react-query';
import { getAdminAnomalies, getAdminAnomalySummary } from '@/service/api/admin/anomaly';
import { AdminAnomalyParams, AdminAnomalySummaryParams } from '@/service/interface/admin/anomaly';
export const adminAnomalyQueryKey = ['admin-anomaly'] as const;
export const adminAnomalyListQueryOptions = (params: AdminAnomalyParams) => queryOptions({ queryKey: [...adminAnomalyQueryKey, 'list', params] as const, queryFn: () => getAdminAnomalies(params), staleTime: 15_000 });
export const adminAnomalySummaryQueryOptions = (params: AdminAnomalySummaryParams) => queryOptions({ queryKey: [...adminAnomalyQueryKey, 'summary', params] as const, queryFn: () => getAdminAnomalySummary(params), staleTime: 15_000 });
