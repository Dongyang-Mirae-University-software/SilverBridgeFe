import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const patch = vi.fn();
const remove = vi.fn();

vi.mock('@/lib/api/apiClient', () => ({ apiClient: { get, patch, delete: remove } }));

import { deleteAdminUser, getAdminUser, getAdminUserCounts, getAdminUsers, updateAdminUser } from './user';

describe('관리자 회원 관리 API', () => {
  beforeEach(() => {
    get.mockReset(); patch.mockReset(); remove.mockReset();
    get.mockResolvedValue({ data: { data: {} } });
    patch.mockResolvedValue({ data: { data: null } });
    remove.mockResolvedValue({ data: { data: null } });
  });

  it('검색·필터·페이지 정보를 회원 목록 요청에 전달한다', async () => {
    const params = { keyword: '홍길동', role: 'GUARDIAN' as const, status: 'ACTIVE' as const, connection: 'CONNECTED' as const, page: 1, size: 20 };
    await getAdminUsers(params);
    expect(get).toHaveBeenCalledWith('/admin/user', { params });
  });

  it('탭별 건수와 회원 상세를 관리자 주소에서 조회한다', async () => {
    await getAdminUserCounts();
    await getAdminUser('EE81BF');
    expect(get).toHaveBeenNthCalledWith(1, '/admin/user/counts');
    expect(get).toHaveBeenNthCalledWith(2, '/admin/user/EE81BF');
  });

  it('회원 수정과 강제 탈퇴를 회원 ID 단위로 요청한다', async () => {
    await updateAdminUser('EE81BF', { status: 'RESTRICTED', statusReason: '확인 중' });
    await deleteAdminUser('EE81BF');
    expect(patch).toHaveBeenCalledWith('/admin/user/EE81BF', { status: 'RESTRICTED', statusReason: '확인 중' });
    expect(remove).toHaveBeenCalledWith('/admin/user/EE81BF');
  });
});
