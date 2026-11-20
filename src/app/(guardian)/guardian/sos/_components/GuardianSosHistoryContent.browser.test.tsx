// 보호자 SOS 이력 - 피보호자 목록을 받기 전·실패했을 때 "연결된 피보호자가 없습니다"로 보이지 않는지. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { clearSelectedWardId } from '@/store/selectedWardStore';
import GuardianSosHistoryContent from './GuardianSosHistoryContent';

const data = vi.hoisted(() => ({
  connections: (async () => ({ data: [] })) as () => Promise<unknown>,
  historyParams: [] as unknown[],
  triggerType: 'CHATBOT_119' as string,
  extra: {} as Record<string, unknown>,
}));

vi.mock('@/service/query/guardian', () => ({
  guardianConnectionsQueryOptions: queryOptions({ queryKey: ['test-connections'], queryFn: () => data.connections() }),
  guardianSosHistoryQueryOptions: (params: unknown) => {
    data.historyParams.push(params);
    return queryOptions({
      queryKey: ['test-sos', params],
      queryFn: async () => ({
        content: [
          {
            sosEventId: 1,
            wardId: 'ward-1',
            wardName: '김영희',
            triggeredAt: '2026-11-17T01:00:00Z',
            location: null,
            triggerType: data.triggerType,
            ...data.extra,
          },
        ],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        last: true,
        counts: { all: 6, sosButton: 2, guardianCall: 1, chatbot119: 1, chatbot109: 2 },
      }),
    });
  },
}));

function renderSos() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuardianSosHistoryContent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  clearSelectedWardId();
  data.historyParams = [];
  data.triggerType = 'CHATBOT_119';
  data.extra = {};
});
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

describe('SOS 이력 챗봇 119 필터 (Chrome)', () => {
  it('챗봇 119 필터에 건수가 보이고, 누르면 triggerType CHATBOT_119 로 조회하며 항목에 라벨이 붙는다', async () => {
    data.connections = async () => ({
      data: [{ id: 1, partnerUserId: 'ward-1', partnerName: '김영희', partnerProfileImage: null, status: 'ACTIVE', connectedAt: null }],
    });
    await renderSos();

    const filter = page.getByRole('button', { name: /챗봇 119/ });
    await expect.element(filter.first()).toBeVisible();
    await expect.element(filter.first()).toMatchTextContent('챗봇 119 1');

    await filter.first().click();
    await vi.waitFor(() =>
      expect(data.historyParams.some(params => (params as { triggerType?: string }).triggerType === 'CHATBOT_119')).toBe(true),
    );
    await expect.element(page.getByText('챗봇 119', { exact: true }).last()).toBeVisible();
  });

  it('모르는 발생 경로 값이 와도 목록이 깨지지 않는다(BE 영향 점검 H-1)', async () => {
    data.triggerType = 'FUTURE_TRIGGER';
    data.connections = async () => ({
      data: [{ id: 1, partnerUserId: 'ward-1', partnerName: '김영희', partnerProfileImage: null, status: 'ACTIVE', connectedAt: null }],
    });
    await renderSos();

    await expect.element(page.getByRole('button', { name: /챗봇 119/ }).first()).toBeVisible();
    await vi.waitFor(() => expect(document.querySelectorAll('[class*="eventMarker"]').length).toBeGreaterThan(0));
    // 모르는 값에는 경로 배지를 붙이지 않는다(라벨이 없으므로)
    expect(document.querySelectorAll('[class*="pressBadge"]')).toHaveLength(0);
  });
});

describe('SOS 이력 챗봇 109 필터 (Chrome, 2026-11-20 BE 영향 점검 L-2)', () => {
  const connected = async () => ({
    data: [{ id: 1, partnerUserId: 'ward-1', partnerName: '김영희', partnerProfileImage: null, status: 'ACTIVE', connectedAt: null }],
  });

  it('챗봇 109 필터에 건수가 보이고, 누르면 triggerType CHATBOT_109 로 조회하며 항목에 라벨 배지가 붙는다', async () => {
    data.triggerType = 'CHATBOT_109';
    data.connections = connected;
    await renderSos();

    const filter = page.getByRole('button', { name: /챗봇 109/ });
    await expect.element(filter.first()).toBeVisible();
    await expect.element(filter.first()).toMatchTextContent('챗봇 109 2');

    await filter.first().click();
    await vi.waitFor(() =>
      expect(data.historyParams.some(params => (params as { triggerType?: string }).triggerType === 'CHATBOT_109')).toBe(true),
    );
    await vi.waitFor(() => {
      const badges = Array.from(document.querySelectorAll('[class*="pressBadge"]')).map(el => el.textContent);
      expect(badges).toEqual(['챗봇 109']);
    });
  });

  it('SOS 버튼·보호자 연락 항목에는 경로 배지가 없다', async () => {
    for (const triggerType of ['SOS_BUTTON', 'GUARDIAN_CALL']) {
      data.triggerType = triggerType;
      data.connections = connected;
      const screen = await renderSos();
      await vi.waitFor(() => expect(document.querySelectorAll('[class*="eventMarker"]').length).toBeGreaterThan(0));
      expect(document.querySelectorAll('[class*="pressBadge"]'), triggerType).toHaveLength(0);
      await screen.unmount();
    }
  });
});

describe('SOS 이력 휴대폰 폭 배치 (Chrome, 2026-11-21)', () => {
  it('393px 폭에서 연달아 누름 배지와 보호자 뱃지가 시각 아래 줄에 놓이고 항목 밖으로 나가지 않는다', async () => {
    await page.viewport(393, 852);
    data.triggerType = 'GUARDIAN_CALL';
    data.extra = { pressCount: 2, calledGuardianName: '테스트보호자2' };
    data.connections = async () => ({
      data: [{ id: 1, partnerUserId: 'ward-1', partnerName: '김영희', partnerProfileImage: null, status: 'ACTIVE', connectedAt: null }],
    });
    await renderSos();

    await vi.waitFor(() => expect(document.querySelectorAll('[class*="guardianChip"]')).toHaveLength(1));
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const item = document.querySelector('[class*="eventMarker"]')!.parentElement!.getBoundingClientRect();
    const time = box('[class*="eventTime"]');
    const badge = box('[class*="pressBadge"]');
    const chip = box('[class*="guardianChip"]');

    // 한 줄에 다 놓으면 393px 에서 오른쪽 뱃지가 카드 밖으로 잘렸다(2026-11-20 시연 영상 녹화 중 확인)
    expect(badge.top).toBeGreaterThanOrEqual(time.bottom);
    expect(chip.top).toBeGreaterThanOrEqual(time.bottom);
    expect(chip.right).toBeLessThanOrEqual(item.right);
    // 배지는 날짜 글자가 시작하는 자리에서 시작한다
    expect(Math.abs(badge.left - time.left)).toBeLessThanOrEqual(1);
  });
});
