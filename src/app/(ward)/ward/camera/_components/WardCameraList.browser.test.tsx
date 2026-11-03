// 내 카메라 목록 - 목록을 못 받았을 때 "아직 등록한 카메라가 없어요"·등록 버튼으로 보이지 않는지. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { WardCameraList } from './WardCameraList';

const data = vi.hoisted(() => ({ cameras: (async () => []) as () => Promise<unknown> }));

vi.mock('@/service/query/ward/camera', () => ({
  wardLiveCamerasQueryOptions: queryOptions({ queryKey: ['test-ward-cameras'], queryFn: () => data.cameras(), retry: false }),
  useDeleteWardCameraMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WardCameraList
        onRegister={vi.fn()}
        primaryAction={{ kind: 'register' }}
        isConnecting={false}
        isPrimaryBusy={false}
        onPrimary={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('WardCameraList 불러오기 실패 (Chrome)', () => {
  it('목록 조회가 실패하면 등록 안내 대신 실패 안내와 다시 불러오기를 보이고, 다시 받으면 실제 상태를 보인다', async () => {
    let fail = true;
    data.cameras = async () => {
      if (fail) throw new Error('server down');
      return [];
    };
    await renderList();

    await expect.element(page.getByRole('alert')).toMatchTextContent('카메라 목록을 불러오지 못했어요.');
    expect(page.getByText('아직 등록한 카메라가 없어요').elements()).toHaveLength(0);
    fail = false;
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect.element(page.getByText('아직 등록한 카메라가 없어요')).toBeVisible();
  });
});
