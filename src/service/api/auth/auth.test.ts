import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/api/apiClient', () => ({ apiClient: { post } }));

import { findPasswordEmailResend, findPasswordEmailSend } from './auth';

describe('비밀번호 찾기 메일 발송 (QA AUTH-A36)', () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: { data: null } });
  });

  it('발송·재발송은 기본 10초보다 넉넉히 기다린다', async () => {
    await findPasswordEmailSend({ email: 'a@b.com' });
    await findPasswordEmailResend({ email: 'a@b.com' });

    expect(post.mock.calls[0][2]).toMatchObject({ timeout: 30_000 });
    expect(post.mock.calls[1][2]).toMatchObject({ timeout: 30_000 });
  });
});
