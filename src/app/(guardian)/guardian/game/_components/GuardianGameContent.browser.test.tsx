// 보호자 게임 관리 - BE 중계(wardId)로 부르고 오류 코드별 문구를 보인다. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { IConnectionItem } from '@/service/interface/connection';
import type { IWardGameSummary } from '@/service/interface/game';
import { GuardianGameContent } from './GuardianGameContent';

const data = vi.hoisted(() => ({
  wards: [] as unknown[],
  summary: vi.fn<(wardId: string) => Promise<unknown>>(),
  activity: vi.fn<(wardId: string) => Promise<unknown>>(),
}));

vi.mock('@/components/Icon', () => ({ Icon: () => <span /> }));
vi.mock('@/hooks/useActiveConnections', () => ({
  useGuardianActiveWards: () => ({ activeWards: data.wards, isLoading: false, isError: false }),
}));
vi.mock('@/service/api/guardian/game', () => ({
  getWardGameSummary: (wardId: string) => data.summary(wardId),
  getWardGameActivity: (wardId: string) => data.activity(wardId),
}));

const WARD: IConnectionItem = {
  id: 1,
  partnerUserId: 'aB3x9Z',
  partnerName: '김할머니',
  partnerProfileImage: null,
  status: 'ACTIVE',
} as IConnectionItem;

const SUMMARY: IWardGameSummary = {
  wardId: 'aB3x9Z',
  totalScore: 120,
  totalAttempts: 9,
  lastPlayedAt: null,
  games: [
    {
      game: { slug: 'maze', title: '미로 찾기', description: '', totalStages: 10, themeColor: '#3366ff' },
      progress: {
        gameSlug: 'maze',
        currentStageNo: 3,
        score: 120,
        attempts: 9,
        cleared: false,
        lastAnswerCorrect: true,
        startedAt: null,
        updatedAt: null,
        clearedAt: null,
      },
    },
  ],
};

function apiError(status: number, code: string) {
  return new AxiosError('error', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, code },
  });
}

function renderContent() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuardianGameContent />
    </QueryClientProvider>,
  );
}

describe('GuardianGameContent', () => {
  beforeEach(() => {
    data.wards = [WARD];
    data.summary.mockReset();
    data.activity.mockReset();
    data.activity.mockResolvedValue([]);
  });

  it('피보호자 ID를 그대로 넘겨 게임 기록을 보인다', async () => {
    data.summary.mockResolvedValue(SUMMARY);
    await renderContent();

    await expect.element(page.getByText('미로 찾기')).toBeVisible();
    await expect.element(page.getByText('진행 중')).toBeVisible();
    expect(data.summary).toHaveBeenCalledWith('aB3x9Z');
    expect(data.activity).toHaveBeenCalledWith('aB3x9Z');
  });

  it('403 GAME_NOT_AUTHORIZED면 연결 상태 확인 안내', async () => {
    data.summary.mockRejectedValue(apiError(403, 'GAME_NOT_AUTHORIZED'));
    await renderContent();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('연결된 어르신의 게임 기록만 볼 수 있습니다. 연결 상태를 확인해 주세요.');
  });

  it('503 GAME_UNAVAILABLE이면 잠시 후 다시 시도 안내', async () => {
    data.summary.mockRejectedValue(apiError(503, 'GAME_UNAVAILABLE'));
    await renderContent();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('게임 기록을 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
  });

  it('그 밖의 오류는 기존 문구', async () => {
    data.summary.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
    await renderContent();

    await expect.element(page.getByRole('alert')).toHaveTextContent('게임 기록을 불러오지 못했습니다.');
  });

  it('요약은 되고 활동만 실패하면 빈 히트맵 대신 안내를 보인다', async () => {
    data.summary.mockResolvedValue(SUMMARY);
    data.activity.mockRejectedValue(apiError(503, 'GAME_UNAVAILABLE'));
    await renderContent();

    await expect.element(page.getByText('미로 찾기')).toBeVisible();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('최근 활동 기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
    expect(document.body.textContent).not.toContain('0일 · 0문제');
  });

  it('BE가 null을 실은 필드는 기본값으로 보인다(NaN 없음)', async () => {
    data.summary.mockResolvedValue({
      ...SUMMARY,
      games: [
        {
          game: { slug: 'maze', title: null, description: null, totalStages: null, themeColor: null },
          progress: null,
        },
        {
          game: { ...SUMMARY.games[0].game, slug: 'quiz', title: '초성퀴즈' },
          progress: { ...SUMMARY.games[0].progress!, currentStageNo: null, score: null, attempts: null, cleared: null },
        },
      ],
    } satisfies IWardGameSummary);
    await renderContent();

    await expect.element(page.getByText('0 / 0 문제')).toBeVisible();
    await expect.element(page.getByText('0 / 10 문제')).toBeVisible();
    await expect.element(page.getByText('게임', { exact: true })).toBeVisible();
    expect(document.body.textContent).not.toContain('NaN');
  });
});
