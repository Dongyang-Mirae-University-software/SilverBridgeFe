'use client';

import { queryOptions } from '@tanstack/react-query';

import { getAdminOperationDashboard, getAdminSafetyDashboard } from '@/service/api/admin/dashboard';

const ADMIN_DASHBOARD_REFETCH_INTERVAL = 30_000;

export const adminSafetyDashboardQueryKey = ['admin-dashboard', 'safety'] as const;
export const adminOperationDashboardQueryKey = ['admin-dashboard', 'operation'] as const;

// 탭이 열려 있을 때만 요청한다. 서버 캐시가 없어서 30초보다 짧게 폴링하지 않는다.
export const adminSafetyDashboardQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: adminSafetyDashboardQueryKey,
    queryFn: getAdminSafetyDashboard,
    enabled,
    staleTime: ADMIN_DASHBOARD_REFETCH_INTERVAL,
    refetchInterval: enabled ? ADMIN_DASHBOARD_REFETCH_INTERVAL : false,
  });

export const adminOperationDashboardQueryOptions = (enabled: boolean) =>
  queryOptions({
    queryKey: adminOperationDashboardQueryKey,
    queryFn: getAdminOperationDashboard,
    enabled,
    staleTime: ADMIN_DASHBOARD_REFETCH_INTERVAL,
    refetchInterval: enabled ? ADMIN_DASHBOARD_REFETCH_INTERVAL : false,
  });
