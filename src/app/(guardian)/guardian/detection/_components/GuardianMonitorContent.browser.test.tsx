// 이상감지 페이지 - 푸시 딥링크(?session=) 처리 컴포넌트 테스트. 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import GuardianMonitorContent from './GuardianMonitorContent';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('session=ward_push') }));
vi.mock('./AnomalyHistoryContent', () => ({ AnomalyHistoryContent: () => null }));
// 실시간 모달 대신 받은 값만 보여 준다
vi.mock('./LiveCameraModal', () => ({
  LiveCameraModal: ({ initialSessionId, onClose }: { initialSessionId?: string | null; onClose: () => void }) => (
    <div role="dialog">
      <span>세션:{initialSessionId ?? '없음'}</span>
      <button type="button" onClick={onClose}>
        모달 닫기
      </button>
    </div>
  ),
}));
vi.mock('@/service/query/guardian', () => ({
  guardianConnectionsQueryOptions: { queryKey: ['guardian-connections-test'], queryFn: () => [] },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('GuardianMonitorContent (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('푸시로 연 카메라는 첫 열기에만 쓰고, 닫은 뒤 다시 열면 지정하지 않는다', async () => {
    const screen = render(<GuardianMonitorContent />, { wrapper });
    await expect.element(screen.getByText('세션:ward_push')).toBeInTheDocument();

    await screen.getByRole('button', { name: '모달 닫기' }).click();
    await screen.getByRole('button', { name: '실시간 카메라 보기' }).click();
    await expect.element(screen.getByText('세션:없음')).toBeInTheDocument();
  });
});
