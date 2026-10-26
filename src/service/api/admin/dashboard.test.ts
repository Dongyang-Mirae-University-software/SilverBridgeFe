import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('@/lib/api/apiClient', () => ({ apiClient: { get } }));

import { getAdminOperationDashboard, getAdminSafetyDashboard } from './dashboard';

describe('관리자 대시보드 API', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { data: { ok: true } } });
  });

  it('안전 현황을 관리자 안전 집계 주소로 조회한다', async () => {
    await getAdminSafetyDashboard();
    expect(get).toHaveBeenCalledWith('/admin/dashboard/safety');
  });

  it('운영 현황을 관리자 운영 집계 주소로 조회한다', async () => {
    await getAdminOperationDashboard();
    expect(get).toHaveBeenCalledWith('/admin/dashboard/operation');
  });
});
