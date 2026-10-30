import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api/apiClient', () => ({ apiClient: { get } }));

import { getWardPendingConnections } from './connection';

function pendingResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      code: 200,
      success: true,
      data: [
        {
          connectionId: 5,
          guardianId: 'Hy2kW9',
          guardianName: '박철수',
          guardianPhone: '010****7788',
          relation: '손자',
          requestedAt: '2026-05-08T09:00:00+09:00',
          ...overrides,
        },
      ],
    },
  };
}

describe('피보호자 받은 연결 요청 API', () => {
  beforeEach(() => get.mockReset());

  it('BE가 준 보호자 사진을 화면 모양(partnerProfileImage)으로 옮긴다', async () => {
    get.mockResolvedValue(pendingResponse({ guardianProfileImage: 'https://files.example/p.png' }));
    const result = await getWardPendingConnections();

    expect(get).toHaveBeenCalledWith('/ward/connection/pending');
    expect(result.data?.[0]).toMatchObject({
      id: 5,
      partnerName: '박철수',
      partnerProfileImage: 'https://files.example/p.png',
      relation: '손자',
      status: 'PENDING',
    });
  });

  it('사진이 없으면 null로 두고, 수락 전이라 주소·이메일은 싣지 않는다', async () => {
    get.mockResolvedValue(pendingResponse());
    const item = (await getWardPendingConnections()).data?.[0];

    expect(item?.partnerProfileImage).toBeNull();
    expect(item?.partnerAddress).toBeNull();
    expect(item?.partnerEmail).toBeNull();
  });
});
