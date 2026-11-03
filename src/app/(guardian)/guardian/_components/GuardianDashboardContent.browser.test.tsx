// 보호자 대시보드 - 확인할 일 건수가 있는 칸에 테두리(v13.0 시안). 실제 Chrome에서 돈다(`npm run test:browser`)
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { GuardianDashboardResponse } from '@/service/interface/guardian/dashboard';
import { clearSelectedWardId } from '@/store/selectedWardStore';
import '@/app/globals.css';
import { GuardianDashboardContent } from './GuardianDashboardContent';

const data = vi.hoisted(() => ({ dashboard: null as unknown, connections: null as (() => Promise<unknown>) | null }));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/service/query/guardian', () => ({
  guardianConnectionsQueryOptions: queryOptions({
    queryKey: ['test-connections'],
    queryFn: async () => data.connections ? data.connections() : ({
      data: [
        {
          id: 1,
          partnerUserId: 'ward01',
          partnerName: '김영희',
          partnerProfileImage: null,
          relation: '어머니',
          status: 'ACTIVE',
          connectedAt: '2026-10-01T00:00:00Z',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ],
    }),
  }),
  guardianDashboardQueryOptions: ({ wardId }: { wardId?: string } = {}) =>
    queryOptions({ queryKey: ['test-dashboard', wardId ?? 'all'], queryFn: async () => data.dashboard }),
}));

function dashboard(
  pending: { anomaly?: number; medication?: number; needsReview?: number | null; sosThisMonth?: number },
  unavailable: string[] = [],
) {
  const anomaly = pending.anomaly ?? 0;
  const medication = pending.medication ?? 0;
  return {
    pendingActions: { total: anomaly + medication, anomaly, medication },
    wards: [{ wardId: 'ward01', wardName: '김영희', pendingCount: anomaly + medication }],
    anomalyDetection: { needsReviewCount: pending.needsReview === undefined ? anomaly : pending.needsReview, latest: null },
    sos: { thisMonthCount: pending.sosThisMonth ?? 0, latest: null },
    medication: { uncheckedCount: medication, mostUrgent: null },
    unavailable,
  } as GuardianDashboardResponse;
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuardianDashboardContent />
    </QueryClientProvider>,
  );
}

const borderOf = (element: Element) => {
  const style = getComputedStyle(element);
  return { width: style.borderTopWidth, color: style.borderTopColor, background: style.backgroundColor };
};

beforeEach(() => {
  clearSelectedWardId();
  data.connections = null;
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('보호자 대시보드 확인 필요 테두리 (Chrome)', () => {
  it('이상감지 건수가 있으면 이상감지 칸에 빨간 3px 테두리와 확인 필요 알약을 둔다', async () => {
    data.dashboard = dashboard({ anomaly: 2 });
    await renderDashboard();

    const tile = page.getByRole('link', { name: 'AI 이상감지, 확인 필요 2건' });
    await expect.element(tile).toBeVisible();
    await expect.element(tile.getByText('확인 필요')).toBeVisible();
    expect(borderOf(tile.element()).width).toBe('3px');
  });

  it('검토 건수(needsReviewCount)가 비어 와도 이상감지 대기 건수가 있으면 테두리를 켠다', async () => {
    data.dashboard = dashboard({ anomaly: 1, needsReview: null });
    await renderDashboard();

    await expect.element(page.getByRole('link', { name: 'AI 이상감지, 확인 필요 1건' })).toBeVisible();
  });

  it('실제 응답(약 2건·이상감지 0건·이번 달 SOS 0건)이면 아무 칸도 강조하지 않는다(시안에 약 강조가 없다)', async () => {
    data.dashboard = {
      pendingActions: { total: 2, anomaly: 0, medication: 2 },
      wards: [{ wardId: 'ward01', wardName: '김철수', pendingCount: 2 }],
      anomalyDetection: { needsReviewCount: 0, latest: null },
      sos: { thisMonthCount: 0, latest: null },
      medication: { uncheckedCount: 2, mostUrgent: null },
      unavailable: [],
    };
    await renderDashboard();

    await expect.element(page.getByText('확인이 필요한 일 2건')).toBeVisible();
    expect(borderOf(page.getByRole('link', { name: '약 관리' }).element()).background).toBe('rgb(243, 236, 227)');
    expect(borderOf(page.getByRole('link', { name: 'SOS 내역' }).element()).background).toBe('rgb(243, 236, 227)');
    expect(borderOf(page.getByRole('link', { name: 'AI 이상감지' }).element()).width).not.toBe('3px');
  });

  it('이번 달 SOS가 1건 이상이면 이상감지 카드에 빨간 3px 테두리와 확인 필요 배지를 둔다', async () => {
    data.dashboard = dashboard({ sosThisMonth: 1 });
    await renderDashboard();

    const tile = page.getByRole('link', { name: 'AI 이상감지, 이번 달 SOS 1건' });
    await expect.element(tile).toBeVisible();
    await expect.element(tile.getByText('확인 필요')).toBeVisible();
    expect(borderOf(tile.element()).width).toBe('3px');
  });

  it('이번 달 SOS가 있으면 SOS 내역 칩을 시안의 강조 칩(#E2A49A 테두리·#FFF1EE)으로 그린다', async () => {
    data.dashboard = dashboard({ sosThisMonth: 1 });
    await renderDashboard();

    const chip = page.getByRole('link', { name: 'SOS 내역, 이번 달 SOS 1건' });
    await expect.element(chip).toBeVisible();
    // 1.5px 테두리는 1배율 화면에서 Chrome이 1px로 그린다 - 굵기 대신 색으로 본다
    expect(borderOf(chip.element())).toMatchObject({ color: 'rgb(226, 164, 154)', background: 'rgb(255, 241, 238)' });
  });

  it('보이지 않는 h1 "보호자 대시보드"를 둔다(시안에는 제목이 없다)', async () => {
    data.dashboard = dashboard({});
    await renderDashboard();

    await expect.element(page.getByRole('heading', { name: '보호자 대시보드', level: 1 })).toBeInTheDocument();
  });

  it('확인할 일이 없으면 테두리 강조가 없다', async () => {
    data.dashboard = dashboard({});
    await renderDashboard();

    await expect.element(page.getByText('지금 확인할 일이 없어요')).toBeVisible();
    expect(borderOf(page.getByRole('link', { name: 'AI 이상감지' }).element()).width).not.toBe('3px');
    expect(borderOf(page.getByRole('link', { name: '약 관리' }).element()).background).toBe('rgb(243, 236, 227)');
  });

  it('조회 실패한 칸(unavailable)은 건수가 있어도 강조하지 않는다', async () => {
    data.dashboard = dashboard({ anomaly: 2, medication: 1, sosThisMonth: 1 }, ['anomalyDetection', 'medication', 'sos']);
    await renderDashboard();

    await expect.element(page.getByRole('link', { name: 'AI 이상감지' })).toBeVisible();
    await expect.element(page.getByRole('link', { name: '약 관리' })).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'SOS 내역' })).toBeVisible();
  });
});

describe('보호자 대시보드 불러오기 상태 (Chrome)', () => {
  it('연결 목록을 받는 동안에는 "연결된 피보호자가 없습니다" 대신 불러오는 중 안내를 보인다', async () => {
    data.connections = () => new Promise(() => {});
    await renderDashboard();

    await expect.element(page.getByRole('status')).toMatchTextContent('피보호자 정보를 불러오는 중이에요.');
    expect(page.getByText('연결된 피보호자가 없습니다').elements()).toHaveLength(0);
  });

  it('연결 목록 조회가 실패하면 "없음"이 아니라 실패 안내와 다시 불러오기를 보인다', async () => {
    let fail = true;
    data.connections = async () => {
      if (fail) throw new Error('server down');
      return { data: [] };
    };
    data.dashboard = dashboard({});
    await renderDashboard();

    await expect.element(page.getByRole('alert')).toMatchTextContent('피보호자 정보를 불러오지 못했어요.');
    expect(page.getByText('연결된 피보호자가 없습니다').elements()).toHaveLength(0);
    fail = false;
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect.element(page.getByText('연결된 피보호자가 없습니다')).toBeVisible();
  });
});
