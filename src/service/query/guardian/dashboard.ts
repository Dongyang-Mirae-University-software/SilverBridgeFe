'use client';

import { queryOptions } from '@tanstack/react-query';

import { getGuardianDashboard } from '@/service/api/guardian/dashboard';
import { GetGuardianDashboardParams } from '@/service/interface/guardian/dashboard';

export const guardianDashboardQueryOptions = (params: GetGuardianDashboardParams = {}) =>
  queryOptions({
    queryKey: ['guardian-dashboard', params.wardId ?? 'all'] as const,
    queryFn: () => getGuardianDashboard(params),
    staleTime: 30 * 1000,
  });
