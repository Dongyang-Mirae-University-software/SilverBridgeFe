import { describe, expect, it } from 'vitest';

import { adminUserCountsQueryKey, adminUserListQueryOptions, adminUserQueryKey } from './user';

describe('관리자 회원 관리 쿼리', () => {
  it('회원 목록 필터별로 캐시 키를 분리한다', () => {
    const params = { role: 'GUARDIAN' as const, status: 'ACTIVE' as const, connection: 'ALL' as const, page: 0, size: 20 };
    expect(adminUserListQueryOptions(params).queryKey).toEqual(['admin-user', 'list', params]);
  });

  it('목록·건수 조회는 관리자 회원 캐시 그룹을 사용한다', () => {
    expect(adminUserQueryKey).toEqual(['admin-user']);
    expect(adminUserCountsQueryKey).toEqual(['admin-user', 'counts']);
  });
});
