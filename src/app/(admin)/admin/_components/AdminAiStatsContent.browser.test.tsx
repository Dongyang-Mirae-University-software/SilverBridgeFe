// 관리자 AI 통계 > AI 안부 말벗 · 정서 분석 탭 - 오늘 집계 API 값만 보이고 null은 0이 아니라 "-". 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { AdminChatStats, AdminCompanionStats } from '@/service/interface/admin/aiStats';
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

const CHAT: AdminChatStats = {
  from: '2026-11-03',
  to: '2026-11-09',
  totalChats: 12,
  users: 4,
  byRole: { guardian: 7, ward: 5, unknown: 0 },
  byRoute: { reservation: 2, symptom: 6, general: 4, unknown: 0 },
  emergencyGuidance: 1,
  reservationCompleted: 1,
  fallbackReplies: 0,
  routerFailures: 6,
  routerFailuresByKind: { credit: 3, auth: 1, timeout: 2, other: 0 },
  routerStatus: { state: 'ok', recentFailures: 0, windowSec: 600 },
  daily: [{ date: '2026-11-09', totalChats: 12 }],
  generatedAt: '2026-11-09T14:30:00+09:00',
};

async function openChatTab(stats: AdminChatStats) {
  data.chat = () => Promise.resolve(stats);
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminAiStatsContent />
    </QueryClientProvider>,
  );
  await page.getByRole('tab', { name: 'AI 의료 챗봇' }).click();
  await expect.element(page.getByText('라우터(분류 모델) 상태')).toBeVisible();
}

function routerRows() {
  const card = document.querySelector('[aria-labelledby="chat-router-title"]');
  return [...(card?.querySelectorAll('[class*="dataRows"] > div') ?? [])].map(row => row.textContent);
}

describe('AI 의료 챗봇 탭 라우터 상태 (Chrome)', () => {
  it.each([
    [{ state: 'ok', recentFailures: 0, windowSec: 600 }, '정상'],
    [{ state: 'failing', recentFailures: 3, windowSec: 600 }, '실패 중 · 최근 10분 3회'],
    [{ state: 'credit_exhausted', recentFailures: 0, windowSec: 600 }, '크레딧 소진'],
    [{ state: 'off', recentFailures: 0, windowSec: 600 }, '꺼짐 (라우터 키 없음)'],
    [null, '정보 없음'],
    [undefined, '정보 없음'],
  ] as const)('상태 %o → 배지 "%s"', async (routerStatus, label) => {
    await openChatTab({ ...CHAT, routerStatus: routerStatus as AdminChatStats['routerStatus'] });

    expect(routerRows()[0]).toBe(`지금 상태${label}`);
  });

  it('기간 내 실패 수와 원인별 횟수를 응답 그대로 보인다', async () => {
    await openChatTab(CHAT);

    expect(routerRows()).toEqual(['지금 상태정상', '기간 내 실패6건', '크레딧 부족3건', '키 인증 실패1건', '시간 초과2건', '그 밖0건']);
  });

  it('실패 수·원인별이 null이거나 칸이 없으면 0이 아니라 "정보 없음"이고 다른 집계는 그대로다', async () => {
    const oldShape: AdminChatStats = { ...CHAT, routerFailures: null };
    delete oldShape.routerFailuresByKind;
    delete oldShape.routerStatus;
    await openChatTab(oldShape);

    expect(routerRows()).toEqual(['지금 상태정보 없음', '기간 내 실패정보 없음', '크레딧 부족정보 없음', '키 인증 실패정보 없음', '시간 초과정보 없음', '그 밖정보 없음']);
    await expect.element(page.getByText('기간 내 대화')).toBeVisible();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('크레딧 소진일 때만 맨 위에 경고를 띄운다', async () => {
    await openChatTab({ ...CHAT, routerStatus: { state: 'credit_exhausted', recentFailures: 2, windowSec: 600 } });

    await expect.element(page.getByRole('alert')).toBeVisible();
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/^라우터 크레딧이 소진됐습니다\. .*Anthropic 크레딧·결제 상태를 확인해 주세요\./);
  });

  it('카드에 기준 시각을 보이고, 새로 보기를 누를 때만 한 번 다시 부른다 - 부르는 동안 버튼을 잠그고 기존 값을 둔다', async () => {
    let calls = 0;
    await openChatTab(CHAT);
    data.chat = () => { calls += 1; return new Promise(() => {}); };

    await expect.element(page.getByText(/상담 목적을 나누는 모델 · 기준 11\/09.14:30/)).toBeVisible();
    expect(calls).toBe(0);

    await page.getByRole('button', { name: '새로 보기' }).click();
    await expect.element(page.getByRole('button', { name: '불러오는 중' })).toBeDisabled();
    expect(calls).toBe(1);
    expect(routerRows()[0]).toBe('지금 상태정상');
  });

  it('새로 보기로 받은 새 상태를 그린다', async () => {
    await openChatTab(CHAT);
    data.chat = () => Promise.resolve({ ...CHAT, routerStatus: { state: 'credit_exhausted', recentFailures: 1, windowSec: 600 }, generatedAt: '2026-11-09T14:35:00+09:00' });

    await page.getByRole('button', { name: '새로 보기' }).click();
    await expect.element(page.getByRole('alert')).toBeVisible();
    await expect.element(page.getByText(/기준 11\/09.14:35/)).toBeVisible();
    expect(routerRows()[0]).toBe('지금 상태크레딧 소진');
  });

  it.each(['ok', 'failing', 'off'] as const)('%s 상태에서는 크레딧 경고가 없다', async state => {
    await openChatTab({ ...CHAT, routerStatus: { state, recentFailures: state === 'failing' ? 1 : 0, windowSec: 600 } });

    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});
