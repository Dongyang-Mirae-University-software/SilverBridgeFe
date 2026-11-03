// 보호자 SOS 이력 - 피보호자 목록을 받기 전·실패했을 때 "연결된 피보호자가 없습니다"로 보이지 않는지. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { clearSelectedWardId } from '@/store/selectedWardStore';
import GuardianSosHistoryContent from './GuardianSosHistoryContent';

const data = vi.hoisted(() => ({ connections: (async () => ({ data: [] })) as () => Promise<unknown> }));

vi.mock('@/service/query/guardian', () => ({
  guardianConnectionsQueryOptions: queryOptions({ queryKey: ['test-connections'], queryFn: () => data.connections() }),
  guardianSosHistoryQueryOptions: () =>
    queryOptions({
      queryKey: ['test-sos'],
      queryFn: async () => ({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, last: true }),
    }),
}));

function renderSos() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuardianSosHistoryContent />
    </QueryClientProvider>,
  );
}

beforeEach(() => clearSelectedWardId());
afterEach(() => {
  document.body.innerHTML = '';
});

describe('SOS 이력 피보호자 불러오기 상태 (Chrome)', () => {
  it('목록을 받는 동안에는 불러오는 중 안내를 보인다', async () => {
    data.connections = () => new Promise(() => {});
    await renderSos();

    await expect.element(page.getByRole('status')).toMatchTextContent('피보호자 정보를 불러오는 중이에요.');
    expect(page.getByText('연결된 피보호자가 없습니다.').elements()).toHaveLength(0);
  });

  it('목록 조회가 실패하면 실패 안내와 다시 불러오기를 보이고, 다시 받으면 실제 상태를 보인다', async () => {
    let fail = true;
    data.connections = async () => {
      if (fail) throw new Error('server down');
      return { data: [] };
    };
    await renderSos();

    await expect.element(page.getByRole('alert')).toMatchTextContent('피보호자 정보를 불러오지 못했어요.');
    expect(page.getByText('연결된 피보호자가 없습니다.').elements()).toHaveLength(0);
    fail = false;
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect.element(page.getByText('연결된 피보호자가 없습니다.')).toBeVisible();
  });
});
