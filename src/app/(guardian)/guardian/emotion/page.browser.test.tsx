// AI 기분 체크 페이지 - 제목과 오늘 안부 대화 화면을 붙인다. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import GuardianEmotionPage from './page';

vi.mock('@/service/query/guardian', () => ({
  guardianConnectionsQueryOptions: queryOptions({ queryKey: ['test-connections'], queryFn: async () => ({ data: [] }) }),
  wardCompanionTodayQueryOptions: () => queryOptions({ queryKey: ['test-companion'], queryFn: async () => null }),
}));

describe('AI 기분 체크 페이지 (Chrome)', () => {
  it('제목을 보이고 더는 준비 중 안내를 보이지 않는다', async () => {
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <GuardianEmotionPage />
      </QueryClientProvider>,
    );

    await expect.element(page.getByRole('heading', { name: 'AI 기분 체크', level: 1 })).toBeVisible();
    await expect.element(page.getByText('연결된 피보호자가 없습니다.')).toBeVisible();
    expect(page.getByText('AI 기분 체크는 준비 중이에요').elements()).toHaveLength(0);
  });
});
