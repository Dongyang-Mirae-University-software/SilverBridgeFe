import { describe, expect, it } from 'vitest';

import {
  adminOperationDashboardQueryKey,
  adminOperationDashboardQueryOptions,
  adminAiServiceStatusQueryKey,
  adminAiServiceStatusQueryOptions,
  adminSafetyDashboardQueryKey,
  adminSafetyDashboardQueryOptions,
} from './dashboard';

describe('관리자 대시보드 탭별 쿼리', () => {
  it('안전·운영 탭은 서로 다른 캐시 키를 사용한다', () => {
    expect(adminSafetyDashboardQueryKey).toEqual(['admin-dashboard', 'safety']);
    expect(adminOperationDashboardQueryKey).toEqual(['admin-dashboard', 'operation']);
  });

  it('활성 탭만 30초 간격으로 폴링한다', () => {
    const active = adminSafetyDashboardQueryOptions(true);
    const inactive = adminOperationDashboardQueryOptions(false);

    expect(active.enabled).toBe(true);
    expect(active.staleTime).toBe(30_000);
    expect(active.refetchInterval).toBe(30_000);
    expect(inactive.enabled).toBe(false);
    expect(inactive.refetchInterval).toBe(false);
  });

  it('AI 서비스 상태는 활성 안전 탭에서만 60초 간격으로 갱신한다', () => {
    const active = adminAiServiceStatusQueryOptions(true);
    const inactive = adminAiServiceStatusQueryOptions(false);

    expect(adminAiServiceStatusQueryKey).toEqual(['admin-dashboard', 'ai-status']);
    expect(active.refetchInterval).toBe(60_000);
    expect(inactive.refetchInterval).toBe(false);
  });
});
