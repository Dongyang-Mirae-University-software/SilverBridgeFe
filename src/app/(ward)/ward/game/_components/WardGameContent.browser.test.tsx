// 피보호자 게임 선택 화면 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`).
// v13 카드 UI가 기존 AI 게임 iframe 전환을 바꾸지 않는지 확인한다.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { toGameUserId } from '@/utils/game/userId';
import { WardGameContent } from './WardGameContent';

vi.mock('@/service/query/user', () => ({
  myProfileQueryOptions: {
    queryKey: ['test-ward-profile'],
    queryFn: async () => ({ data: { id: 'ward-game-test' } }),
  },
}));

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<WardGameContent />, { wrapper });
}

describe('WardGameContent (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('v13 카드에 게임 이름과 설명만 보이고, 처음 게임을 선택한다', async () => {
    const screen = renderContent();

    await expect.element(screen.getByRole('heading', { name: '게임을 골라 보세요' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /짝 맞추기 카드 짝을 맞춰보세요/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: /미로 찾기 길을 따라 도착해 보세요/ })).toBeVisible();
    expect(screen.getByText(/최고 단계|플레이 횟수/).query()).toBeNull();
  });

  it('게임 카드를 누르면 해당 slug로 기존 AI iframe을 다시 연다', async () => {
    const screen = renderContent();
    const expectedUserId = toGameUserId('ward-game-test');

    await screen.getByRole('button', { name: /미로 찾기 길을 따라 도착해 보세요/ }).click();
    await expect.element(screen.getByRole('button', { name: /미로 찾기 길을 따라 도착해 보세요/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.element(screen.getByTitle('치매 예방 게임')).toHaveAttribute(
      'src',
      `/api/v1/games/embed?userId=${expectedUserId}&gameSlug=maze`,
    );
  });
});
