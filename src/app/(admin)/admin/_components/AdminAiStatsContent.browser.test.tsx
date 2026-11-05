// 관리자 AI 통계 > AI 안부 말벗 · 정서 분석 탭 - 오늘 집계 API 값만 보이고 null은 0이 아니라 "-". 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { AdminCompanionStats } from '@/service/interface/admin/aiStats';
import { AdminAiStatsContent } from './AdminAiStatsContent';

const data = vi.hoisted(() => ({ companion: vi.fn<() => Promise<unknown>>(), chat: (() => new Promise(() => {})) as () => Promise<unknown> }));

vi.mock('@/service/query/admin', () => ({
  adminAnomalySummaryQueryOptions: (params: unknown) => queryOptions({ queryKey: ['test-summary', params], queryFn: () => new Promise(() => {}) }),
  adminAnomalyListQueryOptions: (params: unknown) => queryOptions({ queryKey: ['test-list', params], queryFn: () => new Promise(() => {}) }),
  adminChatStatsQueryOptions: (params: unknown) => queryOptions({ queryKey: ['test-chat', params], queryFn: () => data.chat() }),
  adminCompanionStatsQueryOptions: queryOptions({ queryKey: ['test-companion'], queryFn: () => data.companion() }),
}));

const EMPTY: AdminCompanionStats = {
  date: '2026-11-04',
  askedCount: 0,
  responseRate: null,
  noDialogueWardCount: 0,
  alertSentCount: 0,
  moodDistribution: { wardCount: 0, joy: 0, calm: 0, worry: 0, depressed: 0, unknown: 0 },
  continuingWards: [],
  noDialogueWards: [],
  generatedAt: '2026-11-04T15:20:00+09:00',
};

const SAMPLE: AdminCompanionStats = {
  ...EMPTY,
  askedCount: 170,
  responseRate: 82,
  noDialogueWardCount: 2,
  alertSentCount: 3,
  moodDistribution: { wardCount: 34, joy: 14, calm: 12, worry: 5, depressed: 2, unknown: 1 },
  continuingWards: [
    { wardId: 'AB1234', name: '이순자', mood: 'WORRY', days: 4 },
    { wardId: 'CD5678', name: null, mood: 'DEPRESSED', days: 3 },
  ],
  noDialogueWards: [{ wardId: 'EF9012', name: '곽순자', lastDialogueAt: null }],
};

async function openTalkTab() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminAiStatsContent />
    </QueryClientProvider>,
  );
  await page.getByRole('tab', { name: 'AI 안부 말벗 · 정서 분석' }).click();
}

function statValues() {
  return [...document.querySelectorAll('[aria-label="AI 안부 말벗 집계"] > div')].map(cell => cell.textContent);
}

beforeEach(() => data.companion.mockReset());
afterEach(() => {
  document.body.innerHTML = '';
});

describe('AI 안부 말벗 · 정서 분석 탭 (Chrome)', () => {
  it('탭을 열 때만 집계를 부른다', async () => {
    data.companion.mockResolvedValue(EMPTY);
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminAiStatsContent />
      </QueryClientProvider>,
    );
    expect(data.companion).not.toHaveBeenCalled();

    await page.getByRole('tab', { name: 'AI 안부 말벗 · 정서 분석' }).click();
    await expect.element(page.getByText('오늘 기분 분포')).toBeVisible();
    expect(data.companion).toHaveBeenCalledTimes(1);
  });

  it('보낸 질문이 없으면 응답률은 0%가 아니라 "-"이고, 빈 목록은 안내를 보인다', async () => {
    data.companion.mockResolvedValue(EMPTY);
    await openTalkTab();

    await expect.element(page.getByText('오늘 마친 대화가 아직 없습니다.')).toBeVisible();
    expect(statValues()).toEqual(['오늘 안부 질문0번', '어르신 응답률-', '오늘 대화 없는 어르신0명', '기분 변화 알림 보냄0건']);
    await expect.element(page.getByText('이어지는 어르신이 없습니다.')).toBeVisible();
    await expect.element(page.getByText('대화가 없는 어르신이 없습니다.')).toBeVisible();
  });

  it('집계·기분 분포·어르신 목록을 응답 그대로 보이고, 판단할 수 없음은 막대 밖에 따로 적는다', async () => {
    data.companion.mockResolvedValue(SAMPLE);
    await openTalkTab();

    await expect.element(page.getByText('마지막 대화 기준 · 34명')).toBeVisible();
    expect(statValues()).toEqual(['오늘 안부 질문170번', '어르신 응답률82%', '오늘 대화 없는 어르신2명', '기분 변화 알림 보냄3건']);
    await expect.element(page.getByRole('img', { name: '기쁨 14명, 평온 12명, 걱정 5명, 우울 2명' })).toBeVisible();
    await expect.element(page.getByText('확인할 수 없음 1명')).toBeVisible();
    await expect.element(page.getByText('이순자')).toBeVisible();
    await expect.element(page.getByText('4일째')).toBeVisible();
    await expect.element(page.getByText('탈퇴한 회원')).toBeVisible();
    await expect.element(page.getByText('대화 기록 없음')).toBeVisible();
  });

  it('불러오지 못하면 다시 시도할 수 있다', async () => {
    data.companion.mockRejectedValueOnce(new Error('down')).mockResolvedValue(EMPTY);
    await openTalkTab();

    await expect.element(page.getByText('AI 안부 말벗 통계를 불러오지 못했습니다.')).toBeVisible();
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect.element(page.getByText('오늘 기분 분포')).toBeVisible();
  });
});

describe('AI 의료 챗봇 탭 오류 안내 (Chrome)', () => {
  it.each([
    [429, undefined, '조회가 너무 잦습니다'],
    [400, 'AI_STATS_INVALID_RANGE', '조회 기간이 올바르지 않습니다'],
    [504, 'AI_STATS_TIMEOUT', 'AI 응답이 늦습니다'],
  ])('%i %s → 이유를 알려 준다', async (status, code, text) => {
    data.chat = () => Promise.reject({ response: { status, data: { code } } });
    await render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AdminAiStatsContent />
      </QueryClientProvider>,
    );
    await page.getByRole('tab', { name: 'AI 의료 챗봇' }).click();

    await expect.element(page.getByText(text)).toBeVisible();
  });
});
