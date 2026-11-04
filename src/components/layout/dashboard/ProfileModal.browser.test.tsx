// 프로필 창 - 이미지를 바꾸면 열린 창의 사진도 새로고침 없이 바로 바뀌는지. 실제 Chrome에서 돈다(`npm run test:browser`)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { IUserProfile } from '@/service/interface/user/user';
import { myProfileQueryKey } from '@/service/query/user';
import { ProfileModal } from './ProfileModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/guardian',
  useSearchParams: () => new URLSearchParams(),
}));

const PROFILE: IUserProfile = {
  id: 'guardian01',
  email: 'guardian@test.com',
  name: '박보호',
  phone: '01012345678',
  provider: 'LOCAL',
  role: 'GUARDIAN',
  profileImage: '/images/old.png',
  gender: 'FEMALE',
  birthDate: '1970-01-01',
  postcode: '12345',
  address: '서울',
  addressDetail: '',
};

describe('ProfileModal (Chrome)', () => {
  it('열려 있는 동안 프로필 캐시가 바뀌면(이미지 변경) 창의 사진·이름이 바로 바뀐다', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(myProfileQueryKey, { code: 200, message: 'OK', success: true, data: PROFILE });

    // 사이드바처럼 열 때의 값을 props로 넘긴다 - 그 뒤로 props는 바뀌지 않는다
    await render(
      <QueryClientProvider client={client}>
        <ProfileModal onClose={vi.fn()} profile={PROFILE} role="GUARDIAN" userId={PROFILE.id} userEmail={PROFILE.email} userName={PROFILE.name} />
      </QueryClientProvider>,
    );
    const dialogImage = () => document.querySelector<HTMLImageElement>('img[src*="/images/"]');
    await vi.waitFor(() => expect(dialogImage()?.getAttribute('src')).toBe('/images/old.png'));

    client.setQueryData(myProfileQueryKey, { code: 200, message: 'OK', success: true, data: { ...PROFILE, name: '박새이름', profileImage: '/images/new.png' } });

    await vi.waitFor(() => expect(dialogImage()?.getAttribute('src')).toBe('/images/new.png'));
    await expect.element(page.getByRole('heading', { name: '박새이름' })).toBeVisible();
  });
});
