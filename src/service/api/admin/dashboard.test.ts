import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock 은 파일 맨 위로 끌어올려지므로 그 안에서 쓰는 함수도 vi.hoisted 로 먼저 만든다(그냥 const 면 초기화 전 접근 오류)
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

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
