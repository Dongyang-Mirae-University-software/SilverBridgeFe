// 보호자 이상감지 이력·판정·영상 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
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

  it('피보호자 목록을 받기 전에는 전체 피보호자 기록·건수를 부르지 않고 불러오는 중으로 둔다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    const screen = await render(
      <AnomalyHistoryContent wards={[]} selectedWardId={undefined} onSelectWard={() => undefined} wardsReady={false} />,
      { wrapper },
    );

    await expect.element(screen.getByText('감지 기록을 불러오는 중이에요.')).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(api.getGuardianAnomalyHistory).not.toHaveBeenCalled();
    expect(api.getGuardianAnomalyHistorySummary).not.toHaveBeenCalled();
  });

  it('탭 건수는 불러온 목록이 아니라 요약 값이고, 유형을 고르면 type 쿼리로 다시 받는다 - 둘 다 지금 등록된 카메라 기준', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    const screen = await renderHistory();

    await expect.element(screen.getByRole('tab', { name: '전체 37' })).toBeInTheDocument();
    await expect.element(screen.getByRole('tab', { name: '화재 20' })).toBeInTheDocument();
    await expect.element(screen.getByRole('tab', { name: '흉기 8' })).toBeInTheDocument();
    await expect.element(screen.getByRole('tab', { name: '낙상 9' })).toBeInTheDocument();
    await expect.element(screen.getByRole('status')).toMatchTextContent('확인 필요 5');
    expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ wardId: 'W1', page: 0, size: 4, type: undefined, camera: 'EXISTING' }),
    );
    expect(api.getGuardianAnomalyHistorySummary).toHaveBeenCalledWith('W1');

    await screen.getByRole('tab', { name: '낙상 9' }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'FALL', camera: 'EXISTING', page: 0 }),
      ),
    );
    await expect.element(screen.getByRole('tab', { name: '낙상 9' })).toHaveAttribute('aria-selected', 'true');
    await expect.element(screen.getByRole('tab', { name: '전체 37' })).toHaveAttribute('aria-selected', 'false');
  });

  it('"확인 필요"는 누를 수 있는 버튼이 아니라 글자 표시다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    const screen = await renderHistory();

    await expect.element(screen.getByRole('status')).toMatchTextContent('확인 필요 5');
    expect(screen.getByRole('button', { name: /확인 필요/ }).query()).toBeNull();
    expect(screen.getByRole('tab', { name: /확인 필요/ }).query()).toBeNull();
    expect(screen.getByRole('status').element().closest('button')).toBeNull();
  });

  it('요약을 못 받으면 건수를 0으로 채우지 않고 비워 둔다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([]));
    api.getGuardianAnomalyHistorySummary.mockRejectedValue(new Error('down'));
    const screen = await renderHistory();

    await expect.element(screen.getByText('감지 기록이 없어요')).toBeInTheDocument();
    await expect.element(screen.getByRole('tab', { name: '전체', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('status').query()).toBeNull();
  });

  it('판정 전에는 두 버튼, 누르면 그 값으로 응답한다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(7)]));
    api.submitAnomalyFeedback.mockResolvedValue({ incidentId: 7, reviewStatus: 'REAL', myVerdict: 'REAL' });
    const screen = await renderHistory();

    await screen.getByRole('button', { name: '실제 위험이에요' }).click();
    await vi.waitFor(() => expect(api.submitAnomalyFeedback).toHaveBeenCalledWith(7, { verdict: 'REAL' }));
  });

  it('판정이 성공하면 대시보드 "확인이 필요한 일" 캐시도 무효화한다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(12)]));
    api.submitAnomalyFeedback.mockResolvedValue({ incidentId: 12, reviewStatus: 'REAL', myVerdict: 'REAL' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['guardian-dashboard', 'all'], { total: 1 });
    const screen = await render(
      <AnomalyHistoryContent wards={[{ wardId: 'W1', wardName: '김순자' }]} selectedWardId="W1" onSelectWard={() => undefined} />,
      { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
    );

    await screen.getByRole('button', { name: '실제 위험이에요' }).click();
    await vi.waitFor(() => expect(client.getQueryState(['guardian-dashboard', 'all'])?.isInvalidated).toBe(true));
  });

  it('판정이 난 뒤에도 "되돌리기"로 다시 고를 수 있다(덮어쓰기)', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(8, { reviewStatus: 'REAL', myVerdict: 'REAL' })]));
    api.submitAnomalyFeedback.mockResolvedValue({ incidentId: 8, reviewStatus: 'FALSE_ALARM', myVerdict: 'FALSE_ALARM' });
    const screen = await renderHistory();

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
    const screen = await renderHistory();

    await expect.element(screen.getByText('괜찮았어요')).toBeInTheDocument();
    expect(screen.getByText('내 응답: 실제 위험이에요').query()).toBeNull();
  });

  it('동수(CONFLICTED)면 다시 답하도록 안내하고 버튼을 둔다 - 다른 보호자의 선택은 보이지 않는다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(10, { reviewStatus: 'CONFLICTED', myVerdict: 'FALSE_ALARM' })]));
    const screen = await renderHistory();

    await expect.element(screen.getByText('다른 보호자와 판정이 달라요. 다시 확인해 주세요.')).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: '괜찮아요' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: '실제 위험이에요' })).toBeInTheDocument();
  });

  it('카메라 행이 없는 기록 카드는 위치 대신 회색 "삭제된 카메라"로 보인다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(11, { cameraLabel: null })]));
    const screen = await renderHistory();

    await expect.element(screen.getByText('삭제된 카메라')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /삭제된 카메라 기록/ }).query()).toBeNull();
  });

  it('삭제된 카메라 기록 스위치는 요약 건수로 보이고, 켜면 camera=DELETED·탭 선택 해제, 탭을 누르면 스위치가 꺼지고 camera=EXISTING', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1, { cameraLabel: null })]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 2 });
    const screen = await renderHistory();

    const deletedSwitch = screen.getByRole('switch', { name: '삭제된 카메라 기록 2' });
    await expect.element(deletedSwitch).not.toBeChecked();
    await deletedSwitch.click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ camera: 'DELETED', type: undefined, page: 0 }),
      ),
    );
    await expect.element(deletedSwitch).toBeChecked();
    for (const name of ['전체 37', '화재 20', '흉기 8', '낙상 9']) {
      await expect.element(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'false');
    }

    await screen.getByRole('tab', { name: '화재 20' }).click();
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ camera: 'EXISTING', type: 'FIRE', page: 0 }),
      ),
    );
    await expect.element(deletedSwitch).not.toBeChecked();
    await expect.element(screen.getByRole('tab', { name: '화재 20' })).toHaveAttribute('aria-selected', 'true');
  });

  it('삭제된 카메라 기록 스위치를 끄면 전체 탭으로 돌아가 지금 카메라(camera=EXISTING, 유형 없음) 목록을 보인다', async () => {
    // camera 값마다 다른 목록 - 끈 뒤 화면의 목록이 어느 조회 결과인지로 확인한다(캐시를 써도 다시 받아도 같은 결과)
    api.getGuardianAnomalyHistory.mockImplementation(async (params: { camera?: string; type?: string }) =>
      params.camera === 'DELETED'
        ? page([incident(2, { cameraLabel: null })])
        : params.type
          ? page([incident(3, { cameraLabel: '작은방', detectedType: 'WEAPON', detectedTypeLabel: '흉기' })])
          : page([incident(1, { cameraLabel: '거실' })]),
    );
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 2 });
    const screen = await renderHistory();

    await screen.getByRole('tab', { name: '흉기 8' }).click();
    await expect.element(screen.getByText('작은방')).toBeInTheDocument();
    const deletedSwitch = screen.getByRole('switch', { name: '삭제된 카메라 기록 2' });
    await deletedSwitch.click();
    await expect.element(deletedSwitch).toBeChecked();
    await expect.element(screen.getByText('삭제된 카메라', { exact: true })).toBeInTheDocument();

    await deletedSwitch.click();
    await expect.element(deletedSwitch).not.toBeChecked();
    await expect.element(screen.getByRole('tab', { name: '전체 37' })).toHaveAttribute('aria-selected', 'true');
    await expect.element(screen.getByText('거실')).toBeInTheDocument();
    expect(screen.getByText('작은방').query()).toBeNull();
    expect(screen.getByText('삭제된 카메라', { exact: true }).query()).toBeNull();
    expect(api.getGuardianAnomalyHistory).toHaveBeenCalledWith(
      expect.objectContaining({ camera: 'EXISTING', type: undefined, page: 0 }),
    );
  });

  it('분류 탭은 화살표 키로 옮겨 고르고, 스위치가 켜져 있으면 화살표로 탭을 골라도 스위치가 꺼진다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 2 });
    const screen = await renderHistory();

    await expect.element(screen.getByRole('switch', { name: '삭제된 카메라 기록 2' })).toBeInTheDocument();
    (screen.getByRole('tab', { name: '전체 37' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    await vi.waitFor(() =>
      expect(api.getGuardianAnomalyHistory).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'FIRE', camera: 'EXISTING' })),
    );
    await expect.element(screen.getByRole('tab', { name: '화재 20' })).toHaveAttribute('aria-selected', 'true');

    const deletedSwitch = screen.getByRole('switch', { name: '삭제된 카메라 기록 2' });
    await deletedSwitch.click();
    await expect.element(deletedSwitch).toBeChecked();
    // 선택이 없으면 첫 탭이 Tab 순서를 받는다
    await expect.element(screen.getByRole('tab', { name: '전체 37' })).toHaveAttribute('tabindex', '0');
    (screen.getByRole('tab', { name: '전체 37' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{End}');
    await expect.element(deletedSwitch).not.toBeChecked();
    await expect.element(screen.getByRole('tab', { name: '낙상 9' })).toHaveAttribute('aria-selected', 'true');
  });

  it('삭제된 카메라 기록이 0건이면 스위치를 보이지 않는다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1)]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, deletedCameraCount: 0 });
    const screen = await renderHistory();

    await expect.element(screen.getByRole('tab', { name: '전체 37' })).toBeInTheDocument();
    expect(screen.getByRole('switch').query()).toBeNull();
    expect(screen.getByText(/삭제된 카메라 기록/).query()).toBeNull();
  });

  it('"전체"가 비었는데 삭제된 카메라 기록이 있으면 없다고 하지 않고 "삭제된 카메라 기록" 스위치로 안내한다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([]));
    api.getGuardianAnomalyHistorySummary.mockResolvedValue({ ...SUMMARY, total: 0, deletedCameraCount: 4 });
    const screen = await renderHistory();

    await expect
      .element(screen.getByText('지금 카메라의 감지 기록이 없어요. 삭제된 카메라의 기록은 "삭제된 카메라 기록"을 켜면 볼 수 있어요'))
      .toBeInTheDocument();
    expect(screen.getByText('감지 기록이 없어요', { exact: true }).query()).toBeNull();
    await expect.element(screen.getByRole('switch', { name: '삭제된 카메라 기록 4' })).toBeInTheDocument();
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
    const screen = await render(<Harness />, { wrapper });

    await screen.getByRole('switch', { name: '삭제된 카메라 기록 2' }).click();
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
    await expect.element(screen.getByRole('tab', { name: '전체 37' })).toHaveAttribute('aria-selected', 'true');
    await expect.element(screen.getByRole('switch', { name: '삭제된 카메라 기록 2' })).not.toBeChecked();
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
    const screen = await render(
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
    // 분류 탭 4칸은 한 줄(같은 높이)이고 터치 영역 44px 이상, 글자가 칸을 넘지 않는다
    const typeTabs = [...box.querySelectorAll('[role="tablist"][aria-label="감지 유형"] [role="tab"]')];
    expect(typeTabs).toHaveLength(4);
    expect(new Set(typeTabs.map(tab => Math.round(tab.getBoundingClientRect().top))).size).toBe(1);
    for (const tab of typeTabs) {
      expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(tab.scrollWidth).toBeLessThanOrEqual(tab.clientWidth);
    }
    // 확인 필요와 스위치는 같은 줄, 화면 안, 스위치 줄은 터치 44px 이상
    const switchLabel = box.querySelector('input[role="switch"]')!.closest('label')!;
    const status = box.querySelector('[role="status"]')!;
    expect(switchLabel.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    expect(switchLabel.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(Math.round(switchLabel.getBoundingClientRect().top)).toBe(Math.round(status.getBoundingClientRect().top));
  });
});

describe('장면별 기록 (Chrome)', () => {
  const older = { clipId: 61, incidentId: 1, detectedAt: '2026-10-13T22:01:03', durationMs: 5000, width: 640, height: 360, sizeBytes: 1000, createdAt: '2026-10-13T22:01:10' };
  const newer = { ...older, clipId: 62, detectedAt: '2026-10-13T22:07:03', createdAt: '2026-10-13T22:07:10' };

  beforeEach(() => {
    api.getGuardianAnomalyHistorySummary.mockResolvedValue(SUMMARY);
    api.fetchGuardianAnomalyClipHead.mockRejectedValue(new Error('no head'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Object.values(api).forEach(fn => fn.mockReset());
  });

  it('영상이 여러 개인 상황은 장면마다 한 줄로 나누고, 판정은 같은 상황끼리 함께 보인다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1, { clip: newer, clipCount: 2 })]));
    api.getGuardianAnomalyClips.mockResolvedValue([newer, older]);
    const screen = await renderHistory();

    await expect.element(screen.getByText('같은 상황의 장면 2/2')).toBeVisible();
    await expect.element(screen.getByText('같은 상황의 장면 1/2')).toBeVisible();
    expect(screen.getByText('영상 2개').query()).toBeNull();
    expect(screen.getByRole('button', { name: '영상 보기' }).elements()).toHaveLength(2);
    expect(api.getGuardianAnomalyClips).toHaveBeenCalledWith(1);
  });

  it('영상이 하나뿐인 상황은 영상 목록을 따로 부르지 않는다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1, { clip: older, clipCount: 1 })]));
    const screen = await renderHistory();

    await expect.element(screen.getByRole('button', { name: '영상 보기' })).toBeVisible();
    expect(screen.getByText(/같은 상황의 장면/).query()).toBeNull();
    expect(api.getGuardianAnomalyClips).not.toHaveBeenCalled();
  });

  it('장면 줄을 누르면 그 장면 영상만 열고 영상 고르기 칩은 없다', async () => {
    api.getGuardianAnomalyHistory.mockResolvedValue(page([incident(1, { clip: newer, clipCount: 2 })]));
    api.getGuardianAnomalyClips.mockResolvedValue([newer, older]);
    api.fetchGuardianAnomalyClipFile.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
    const screen = await renderHistory();
    await expect.element(screen.getByText('같은 상황의 장면 1/2')).toBeVisible();

    // 두 번째 줄(처음 장면 = older)
    await screen.getByRole('button', { name: '영상 보기' }).nth(1).click();
    await vi.waitFor(() => expect(api.fetchGuardianAnomalyClipFile).toHaveBeenCalledWith(61));
    expect(api.fetchGuardianAnomalyClipFile).not.toHaveBeenCalledWith(62);
    expect(screen.getByRole('group', { name: '영상 선택' }).query()).toBeNull();
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
    const screen = await render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, { wrapper });

    await expect.element(screen.getByText(CLIP_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('403은 서버 문구를 그대로 보인다(404와 다른 문구)', async () => {
    api.getGuardianAnomalyClips.mockResolvedValue([clip]);
    api.fetchGuardianAnomalyClipFile.mockRejectedValue({ status: 403, message: '연결된 피보호자의 기록만 볼 수 있습니다.' });
    const screen = await render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, { wrapper });

    await expect.element(screen.getByText('연결된 피보호자의 기록만 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('재생 중이던 클립이 다시 받은 목록에서 빠지면(오탐으로 숨겨짐) 영상을 내리고 안내한다', async () => {
    api.getGuardianAnomalyClips.mockResolvedValueOnce([clip]).mockResolvedValue([]);
    api.fetchGuardianAnomalyClipFile.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const screen = await render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, {
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
    const screen = await render(<AnomalyClipModal incident={incident(1, { clip, clipCount: 1 })} onClose={() => undefined} />, { wrapper });

    await vi.waitFor(() => expect(document.querySelector('video')?.getAttribute('src')).toMatch(/^blob:/));
    const url = document.querySelector('video')!.getAttribute('src');
    expect(document.querySelector('a[download]')).toBeNull();
    await expect.element(screen.getByText('영상을 보고 알려 주세요')).toBeInTheDocument();

    await screen.unmount();
    expect(revoke).toHaveBeenCalledWith(url);
  });
});
