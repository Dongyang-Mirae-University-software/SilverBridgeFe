// 보호자 대시보드 - 확인할 일 건수가 있는 칸에 테두리(v13.0 시안). 실제 Chrome에서 돈다(`npm run test:browser`)
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import type { GuardianDashboardResponse } from '@/service/interface/guardian/dashboard';
import { clearSelectedWardId } from '@/store/selectedWardStore';
import '@/app/globals.css';
import { GuardianDashboardContent } from './GuardianDashboardContent';

const data = vi.hoisted(() => ({ dashboard: null as unknown }));

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
    queryFn: async () => ({
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

function dashboard(pending: { anomaly?: number; medication?: number; needsReview?: number | null }, unavailable: string[] = []) {
  const anomaly = pending.anomaly ?? 0;
  const medication = pending.medication ?? 0;
  return {
    pendingActions: { total: anomaly + medication, anomaly, medication },
    wards: [{ wardId: 'ward01', wardName: '김영희', pendingCount: anomaly + medication }],
    anomalyDetection: { needsReviewCount: pending.needsReview === undefined ? anomaly : pending.needsReview, latest: null },
    sos: { thisMonthCount: 0, latest: null },
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

// 1.5px 테두리는 1배율 화면에서 Chrome이 1px로 그린다 - 굵기 대신 색으로 강조 여부를 본다
const borderOf = (element: Element) => {
  const style = getComputedStyle(element);
  return { width: style.borderTopWidth, color: style.borderTopColor, background: style.backgroundColor };
};

beforeEach(() => clearSelectedWardId());
afterEach(() => {
  document.body.innerHTML = '';
});

describe('보호자 대시보드 확인 필요 테두리 (Chrome)', () => {
  it('이상감지 건수가 있으면 이상감지 칸에 빨간 3px 테두리와 확인 필요 알약을 둔다', async () => {
    data.dashboard = dashboard({ anomaly: 2 });
    renderDashboard();

    const tile = page.getByRole('link', { name: 'AI 이상감지, 확인 필요 2건' });
    await expect.element(tile).toBeVisible();
    await expect.element(tile.getByText('확인 필요')).toBeVisible();
    expect(borderOf(tile.element()).width).toBe('3px');
  });

  it('검토 건수(needsReviewCount)가 비어 와도 이상감지 대기 건수가 있으면 테두리를 켠다', async () => {
    data.dashboard = dashboard({ anomaly: 1, needsReview: null });
    renderDashboard();

    await expect.element(page.getByRole('link', { name: 'AI 이상감지, 확인 필요 1건' })).toBeVisible();
  });

  it('안 드신 약이 있으면 약 관리 칩을 시안의 강조 칩(빨간 1.5px·#FFF1EE)으로 그린다', async () => {
    data.dashboard = dashboard({ medication: 3 });
    renderDashboard();

    const chip = page.getByRole('link', { name: '약 관리, 확인 필요 3건' });
    await expect.element(chip).toBeVisible();
    expect(borderOf(chip.element())).toMatchObject({ color: 'rgb(226, 164, 154)', background: 'rgb(255, 241, 238)' });
    // 이상감지는 건수가 없으니 평소 테두리
    expect(borderOf(page.getByRole('link', { name: 'AI 이상감지' }).element()).width).not.toBe('3px');
  });

  it('확인할 일이 없으면 테두리 강조가 없다', async () => {
    data.dashboard = dashboard({});
    renderDashboard();

    await expect.element(page.getByText('지금 확인할 일이 없어요')).toBeVisible();
    expect(borderOf(page.getByRole('link', { name: 'AI 이상감지' }).element()).width).not.toBe('3px');
    expect(borderOf(page.getByRole('link', { name: '약 관리' }).element()).background).toBe('rgb(243, 236, 227)');
  });

  it('조회 실패한 칸(unavailable)은 건수가 있어도 강조하지 않는다', async () => {
    data.dashboard = dashboard({ anomaly: 2, medication: 1 }, ['anomalyDetection', 'medication']);
    renderDashboard();

    await expect.element(page.getByRole('link', { name: 'AI 이상감지' })).toBeVisible();
    await expect.element(page.getByRole('link', { name: '약 관리' })).toBeVisible();
  });
});
