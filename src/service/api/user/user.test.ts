import { beforeEach, describe, expect, it, vi } from 'vitest';

const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock('@/lib/api/apiClient', () => ({ apiClient: { patch } }));

import { changeMyProfileImage } from './user';

describe('프로필 사진 업로드 (QA AUTH-A43)', () => {
  beforeEach(() => {
    patch.mockReset().mockResolvedValue({ data: { data: null } });
  });

  it('기본 10초보다 넉넉히(30초) 기다린다', async () => {
    await changeMyProfileImage(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(patch.mock.calls[0][0]).toBe('/user/me/image');
    expect(patch.mock.calls[0][2]).toMatchObject({ timeout: 30_000 });
  });
});
