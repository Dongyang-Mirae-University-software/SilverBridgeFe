// '내 프로필'(v13.0 시안) - 피보호자는 간단히 보기 ↔ 정보 바꾸기, 보호자는 처음부터 목록. 항목별 '바꾸기'로 그 자리에서 저장. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { IUserProfile } from '@/service/interface/user/user';
import { myProfileQueryKey } from '@/service/query/user';
import { ProfileModal } from './ProfileModal';

const api = vi.hoisted(() => ({ updateMyProfile: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/ward',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/service/api/user/user', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/user/user')>()),
  updateMyProfile: api.updateMyProfile,
}));

const PROFILE: IUserProfile = {
  id: 'ward01',
  email: 'ward@test.com',
  name: '김영희',
  phone: '01012345678',
  provider: 'LOCAL',
  role: 'WARD',
  profileImage: null,
  gender: 'FEMALE',
  birthDate: '1950-03-05',
  postcode: '06236',
  address: '서울 강남구 테헤란로 1',
  addressDetail: '101동 1203호',
  createdAt: '2026-09-01T00:00:00Z',
};

async function renderModal(profile: IUserProfile = PROFILE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(myProfileQueryKey, { code: 200, message: 'OK', success: true, data: profile });
  return render(
    <QueryClientProvider client={client}>
      <ProfileModal onClose={vi.fn()} profile={profile} role={profile.role} userId={profile.id} userEmail={profile.email} userName={profile.name} />
    </QueryClientProvider>,
  );
}

describe('WardProfileModal (Chrome)', () => {
  it('처음에는 이름·전화와 내 ID 카드만, 정보 바꾸기를 누르면 계정·내 정보 목록을 보인다', async () => {
    await renderModal();

    await expect.element(page.getByRole('heading', { name: '김영희' })).toBeVisible();
    await expect.element(page.getByText('010-1234-5678')).toBeVisible();
    await expect.element(page.getByText('내 ID · 가족에게 알려 주세요')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '카카오톡 공유하기' })).toBeVisible();
    expect(page.getByText('성별 · 생년월일').query()).toBeNull();

    await page.getByRole('button', { name: '정보 바꾸기' }).click();

    await expect.element(page.getByText('여성 · 1950년 3월 5일')).toBeVisible();
    await expect.element(page.getByText('서울 강남구 테헤란로 1, 101동 1203호')).toBeVisible();
    await expect.element(page.getByText('우편번호 06236')).toBeVisible();
    await expect.element(page.getByText('2026년 9월 1일')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '간단히 보기' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '닫기' }).last()).toBeVisible();
  });

  it('이름을 바꾸면 나머지 정보는 그대로 두고 이름만 바꿔 저장한다', async () => {
    api.updateMyProfile.mockResolvedValue({ code: 200, message: 'OK', success: true, data: { ...PROFILE, name: '김순희' } });
    await renderModal();
    await page.getByRole('button', { name: '정보 바꾸기' }).click();

    await page.getByRole('button', { name: '이름 바꾸기' }).click();
    await page.getByRole('textbox', { name: '이름' }).fill('김순희');
    await page.getByRole('button', { name: '저장' }).click();

    await vi.waitFor(() => expect(api.updateMyProfile).toHaveBeenCalledTimes(1));
    expect(api.updateMyProfile.mock.calls[0][0]).toEqual({
      ...{ name: '김순희', phone: '01012345678', gender: 'FEMALE', birthDate: '1950-03-05' },
      ...{ postcode: '06236', address: '서울 강남구 테헤란로 1', addressDetail: '101동 1203호', verificationNonce: null },
    });
    await expect.element(page.getByRole('button', { name: '이름 바꾸기' })).toMatchTextContent('김순희');
  });

  it('보호자는 처음부터 계정·내 정보 목록을 보이고, 내 ID 카드·정보 바꾸기 버튼은 없다', async () => {
    await renderModal({ ...PROFILE, id: 'guardian01', name: '박보호', role: 'GUARDIAN', provider: 'KAKAO', email: 'kakao_1@kakao.com' });

    await expect.element(page.getByRole('heading', { name: '박보호' })).toBeVisible();
    await expect.element(page.getByText('카카오로 로그인')).toBeVisible();
    await expect.element(page.getByText('여성 · 1950년 3월 5일')).toBeVisible();
    expect(page.getByText('내 ID · 가족에게 알려 주세요').query()).toBeNull();
    expect(page.getByRole('button', { name: '정보 바꾸기' }).query()).toBeNull();
    // 카카오 가입은 비밀번호가 없어 비밀번호 줄을 두지 않는다
    expect(page.getByText('비밀번호').query()).toBeNull();
  });
});
