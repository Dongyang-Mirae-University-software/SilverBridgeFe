// 보호자 이상감지 이력·판정·영상 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { AnomalyHistorySummary, AnomalyIncident } from '@/service/interface/guardian/anomaly';
import { AnomalyClipModal, CLIP_UNAVAILABLE_MESSAGE } from './AnomalyClipModal';
import { AnomalyHistoryContent } from './AnomalyHistoryContent';

const api = vi.hoisted(() => ({
  getGuardianAnomalyHistory: vi.fn(),
  getGuardianAnomalyHistorySummary: vi.fn(),
  submitAnomalyFeedback: vi.fn(),
  getGuardianAnomalyClips: vi.fn(),
  fetchGuardianAnomalyClipFile: vi.fn(),
  fetchGuardianAnomalyClipHead: vi.fn(),
}));

vi.mock('@/service/api/guardian/anomaly', async importOriginal => ({
  ...(await importOriginal<object>()),
  ...api,
}));

function incident(id: number, overrides: Partial<AnomalyIncident> = {}): AnomalyIncident {
  return {
    incidentId: id,
    wardId: 'W1',
    wardName: '김순자',
    cameraLabel: '거실',
    detectedType: 'FIRE',
    detectedTypeLabel: '화재',
    startedAt: '2026-10-13T22:01:00',
    lastDetectedAt: '2026-10-13T22:02:00',
    eventCount: 1,
    maxConfidence: 0.7,
    reviewStatus: 'PENDING',
    myVerdict: null,
    clip: null,
    clipCount: 0,
    ...overrides,
  };
}

function page(content: AnomalyIncident[]) {
  return { content, page: 0, size: 10, totalElements: content.length, totalPages: 1, last: true };
}

const SUMMARY: AnomalyHistorySummary = {
  total: 37,
  pendingCount: 4,
  conflictedCount: 1,
  needsReviewCount: 5,
  byType: { fire: 20, fall: 9, weapon: 8 },
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

function renderHistory() {
  return render(
    <AnomalyHistoryContent wards={[{ wardId: 'W1', wardName: '김순자' }]} selectedWardId="W1" onSelectWard={() => undefined} />,
    { wrapper },
  );
}

describe('AnomalyHistoryContent (Chrome)', () => {
  beforeEach(() => {
    api.getGuardianAnomalyHistorySummary.mockResolvedValue(SUMMARY);
    api.fetchGuardianAnomalyClipHead.mockRejectedValue(new Error('no head'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Object.values(api).forEach(fn => fn.mockReset());
  });

  it('칩 건수는 불러온 목록이 아니라 요약 값이고, 유형을 고르면 type 쿼리로 다시 받는다 - 둘 다 지금 등록된 카메라 기준', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    const screen = renderHistory();

    await expect.element(screen.getByRole('button', { name: '전체 37' })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: '화재 20' })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: '흉기 8' })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: '낙상 9' })).toBeInTheDocument();
    await expect.element(screen.getByRole('status')).toHaveTextContent('확인 필요 5');
    expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ wardId: 'W1', page: 0, size: 4, type: undefined, camera: 'EXISTING' }),
    );
    expect(api.getGuardianAnomalyHistorySummary).toHaveBeenCalledWith('W1');

    await screen.getByRole('button', { name: '낙상 9' }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'FALL', camera: 'EXISTING', page: 0 }),
      ),
    );
  });

  it('요약을 못 받으면 건수를 0으로 채우지 않고 비워 둔다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([]));
    api.getGuardianAnomalyHistorySummary.mockRejectedValue(new Error('down'));
    const screen = renderHistory();

    await expect.element(screen.getByText('감지 기록이 없어요')).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: '전체', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('status').query()).toBeNull();
  });

  it('판정 전에는 두 버튼, 누르면 그 값으로 응답한다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(7)]));
    api.submitAnomalyFeedback.mockResolvedValue({ incidentId: 7, reviewStatus: 'REAL', myVerdict: 'REAL' });
    const screen = renderHistory();

    await screen.getByRole('button', { name: '실제 위험이에요' }).click();
    await vi.waitFor(() => expect(api.submitAnomalyFeedback).toHaveBeenCalledWith(7, { verdict: 'REAL' }));
  });

  it('판정이 성공하면 대시보드 "확인이 필요한 일" 캐시도 무효화한다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(12)]));
    api.submitAnomalyFeedback.mockResolvedValue({ incidentId: 12, reviewStatus: 'REAL', myVerdict: 'REAL' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['guardian-dashboard', 'all'], { total: 1 });
    const screen = render(
      <AnomalyHistoryContent wards={[{ wardId: 'W1', wardName: '김순자' }]} selectedWardId="W1" onSelectWard={() => undefined} />,
      { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
    );

    await screen.getByRole('button', { name: '실제 위험이에요' }).click();
    await vi.waitFor(() => expect(client.getQueryState(['guardian-dashboard', 'all'])?.isInvalidated).toBe(true));
  });

  it('판정이 난 뒤에도 "되돌리기"로 다시 고를 수 있다(덮어쓰기)', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(8, { reviewStatus: 'REAL', myVerdict: 'REAL' })]));
    api.submitAnomalyFeedback.mockResolvedValue({ incidentId: 8, reviewStatus: 'FALSE_ALARM', myVerdict: 'FALSE_ALARM' });
    const screen = renderHistory();

    await expect.element(screen.getByText('실제 위험', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '실제 위험이에요' }).query()).toBeNull();
    await expect.element(screen.getByRole('button', { name: '되돌리기' })).toBeInTheDocument();

    await screen.getByRole('button', { name: '되돌리기' }).click();
    await expect.element(screen.getByRole('button', { name: '실제 위험이에요' })).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('button', { name: '괜찮아요' }).click();
    await vi.waitFor(() => expect(api.submitAnomalyFeedback).toHaveBeenCalledWith(8, { verdict: 'FALSE_ALARM' }));
  });

  it('내 표와 다수결 결과가 달라도 결과 배지만 보인다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(9, { reviewStatus: 'FALSE_ALARM', myVerdict: 'REAL' })]));
    const screen = renderHistory();

    await expect.element(screen.getByText('괜찮았어요')).toBeInTheDocument();
    expect(screen.getByText('내 응답: 실제 위험이에요').query()).toBeNull();
  });

  it('동수(CONFLICTED)면 다시 답하도록 안내하고 버튼을 둔다 - 다른 보호자의 선택은 보이지 않는다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(10, { reviewStatus: 'CONFLICTED', myVerdict: 'FALSE_ALARM' })]));
    const screen = renderHistory();

    await expect.element(screen.getByText('다른 보호자와 판정이 달라요. 다시 확인해 주세요.')).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: '괜찮아요' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: '실제 위험이에요' })).toBeInTheDocument();
  });

  it('카메라 행이 없는 기록 카드는 위치 대신 회색 "삭제된 카메라"로 보인다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(11, { cameraLabel: null })]));
    const screen = renderHistory();

    await expect.element(screen.getByText('삭제된 카메라')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /삭제된 카메라 기록/ }).query()).toBeNull();
  });

  it('삭제된 카메라 칩은 요약 건수로 보이고, 누르면 camera=DELETED, 유형 칩으로 옮기면 다시 camera=EXISTING', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1, { cameraLabel: null })]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 2 });
    const screen = renderHistory();

    await screen.getByRole('button', { name: '삭제된 카메라 2' }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ camera: 'DELETED', type: undefined, page: 0 }),
      ),
    );
    await expect.element(screen.getByRole('button', { name: '삭제된 카메라 2' })).toHaveAttribute('aria-pressed', 'true');

    await screen.getByRole('button', { name: '화재 20' }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ camera: 'EXISTING', type: 'FIRE', page: 0 }),
      ),
    );
  });

  it('삭제된 카메라 기록이 0건이면 칩을 보이지 않는다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 0 });
    const screen = renderHistory();

    await expect.element(screen.getByRole('button', { name: '전체 37' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /삭제된 카메라/ }).query()).toBeNull();
  });

  it('"전체"가 비었는데 삭제된 카메라 기록이 있으면 없다고 하지 않고 "삭제된 카메라"로 안내한다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, total: 0, deletedCameraCount: 4 });
    const screen = renderHistory();

    await expect
      .element(screen.getByText('지금 카메라의 감지 기록이 없어요. 삭제된 카메라의 기록은 "삭제된 카메라"에서 볼 수 있어요'))
      .toBeInTheDocument();
    expect(screen.getByText('감지 기록이 없어요', { exact: true }).query()).toBeNull();
    await expect.element(screen.getByRole('button', { name: '삭제된 카메라 4' })).toBeInTheDocument();
  });

  it('피보호자를 바꾸면 필터(삭제된 카메라 포함)와 페이지가 처음으로 돌아간다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue({ ...page([incident(1, { cameraLabel: null })]), totalPages: 3, last: false });
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 2 });
    // 부모처럼 선택한 피보호자를 상태로 들고 있는 틀
    function Harness() {
      const [wardId, setWardId] = useState('W1');
      return (
        <AnomalyHistoryContent
          wards={[{ wardId: 'W1', wardName: '김순자' }, { wardId: 'W2', wardName: '남궁명진' }]}
          selectedWardId={wardId}
          onSelectWard={setWardId}
        />
      );
    }
    const screen = render(<Harness />, { wrapper });

    await screen.getByRole('button', { name: '삭제된 카메라 2' }).click();
    await screen.getByRole('button', { name: '2', exact: true }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ wardId: 'W1', camera: 'DELETED', page: 1 }),
      ),
    );

    await screen.getByRole('tab', { name: /남궁명진/ }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ wardId: 'W2', camera: 'EXISTING', type: undefined, page: 0 }),
      ),
    );
    await expect.element(screen.getByRole('button', { name: '전체 37' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('375px에서 가로로 넘치지 않는다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(
      page([
        incident(1, { reviewStatus: 'CONFLICTED' }),
        incident(2, { reviewStatus: 'REAL', myVerdict: 'FALSE_ALARM', cameraLabel: '작은방2', detectedType: 'WEAPON', detectedTypeLabel: '흉기' }),
        incident(3, { cameraLabel: null, detectedType: 'FALL', detectedTypeLabel: '낙상' }),
      ]),
    );
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 12 });
    const box = document.createElement('div');
    box.style.padding = '0 16px';
    document.body.appendChild(box);
    const screen = render(
      <AnomalyHistoryContent
        wards={[{ wardId: 'W1', wardName: '김순자' }, { wardId: 'W2', wardName: '남궁명진' }]}
        selectedWardId="W1"
        onSelectWard={() => undefined}
      />,
      { wrapper, container: box },
    );
    await expect.element(screen.getByText('작은방2')).toBeInTheDocument();
    await expect.element(screen.getByRole('status')).toBeInTheDocument();

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    for (const button of box.querySelectorAll('button')) {
      expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    }
  });
});

describe('AnomalyClipModal (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    Object.values(api).forEach(fn => fn.mockReset());
  });

  const clip = { clipId: 55, incidentId: 1, detectedAt: '2026-10-13T22:01:03', durationMs: 5000, width: 640, height: 360, sizeBytes: 1000, createdAt: '2026-10-13T22:01:10' };

  it('404면 "볼 수 없는 영상" 안내를 보인다', async () => {
    api.getGuardianAnomalyClips.mockResolvedValue([clip]);
    api.fetchGuardianAnomalyClipFile.mockRejectedValue({ status: 404, code: 'ANOMALY_CLIP_NOT_FOUND', message: '영상을 찾을 수 없습니다.' });
    const screen = render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, { wrapper });

    await expect.element(screen.getByText(CLIP_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('403은 서버 문구를 그대로 보인다(404와 다른 문구)', async () => {
    api.getGuardianAnomalyClips.mockResolvedValue([clip]);
    api.fetchGuardianAnomalyClipFile.mockRejectedValue({ status: 403, message: '연결된 피보호자의 기록만 볼 수 있습니다.' });
    const screen = render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, { wrapper });

    await expect.element(screen.getByText('연결된 피보호자의 기록만 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('재생 중이던 클립이 다시 받은 목록에서 빠지면(오탐으로 숨겨짐) 영상을 내리고 안내한다', async () => {
    api.getGuardianAnomalyClips.mockResolvedValueOnce([clip]).mockResolvedValue([]);
    api.fetchGuardianAnomalyClipFile.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const screen = render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await vi.waitFor(() => expect(document.querySelector('video')).not.toBeNull());

    await client.invalidateQueries({ queryKey: ['guardian-anomaly-clips', 1] });
    await expect.element(screen.getByText(CLIP_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('blob URL로 재생하고, 닫으면 blob URL을 해제한다 - 다운로드 링크는 없다', async () => {
    api.getGuardianAnomalyClips.mockResolvedValue([clip]);
    api.fetchGuardianAnomalyClipFile.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const screen = render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, { wrapper });

    await vi.waitFor(() => expect(document.querySelector('video')?.getAttribute('src')).toMatch(/^blob:/));
    const url = document.querySelector('video')!.getAttribute('src');
    expect(document.querySelector('a[download]')).toBeNull();
    await expect.element(screen.getByText('영상을 보고 알려 주세요')).toBeInTheDocument();

    screen.unmount();
    expect(revoke).toHaveBeenCalledWith(url);
  });
});
