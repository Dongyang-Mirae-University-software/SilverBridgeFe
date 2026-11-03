import { queryOptions } from '@tanstack/react-query';

import { getAdminHospitals, getAdminHospitalSummary } from '@/service/api/admin/hospital';
import { AdminHospitalListParams } from '@/service/interface/admin/hospital';

export const adminHospitalQueryKey = ['admin-hospital'] as const;

export const adminHospitalListQueryOptions = (params: AdminHospitalListParams) => queryOptions({
  queryKey: [...adminHospitalQueryKey, 'list', params] as const,
  queryFn: () => getAdminHospitals(params),
  staleTime: 15_000,
});

export const adminHospitalSummaryQueryOptions = queryOptions({
  queryKey: [...adminHospitalQueryKey, 'summary'] as const,
  queryFn: getAdminHospitalSummary,
  staleTime: 15_000,
});
