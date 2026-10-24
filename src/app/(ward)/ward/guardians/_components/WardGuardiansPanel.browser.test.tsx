// 피보호자 "내 가족" 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { IConnectionItem } from '@/service/interface/connection';
import { WardGuardiansPanel } from './WardGuardiansPanel';

const api = vi.hoisted(() => ({
  getWardActiveConnections: vi.fn(),
  getWardPendingConnections: vi.fn(),
  acceptWardConnection: vi.fn(),
  refuseWardConnectionRequest: vi.fn(),
  disconnectWardConnection: vi.fn(),
}));

vi.mock('@/service/api/ward/connection', async importOriginal => ({
  ...(await importOriginal<object>()),
  ...api,
}));

function guardian(overrides: Partial<IConnectionItem> = {}): IConnectionItem {
  return {
    id: 21,
    partnerUserId: 'kP7mQ2',
    partnerName: '박민수',
    partnerProfileImage: null,
    partnerPhone: '01012345678',
    partnerEmail: 'minsu@example.com',
    relation: '아들',
    status: 'ACTIVE',
    connectedAt: '2026-01-12T09:00:00+09:00',
    createdAt: '2026-01-12T09:00:00+09:00',
    ...overrides,
  };
}

// getWardPendingConnections가 화면 모양으로 바꿔 주는 결과 - 전화번호는 BE가 가린 값이다
function request(overrides: Partial<IConnectionItem> = {}): IConnectionItem {
  return guardian({
    id: 1,
    partnerUserId: 'Hy2kW9',
    partnerName: '박철수',
    partnerPhone: '010****7788',
    partnerEmail: null,
    relation: '손자',
    status: 'PENDING',
    connectedAt: null,
    ...overrides,
  });
}

function ok<T>(data: T) {
  return { code: 200, success: true, data };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.acceptWardConnection.mockResolvedValue(ok(null));
  api.refuseWardConnectionRequest.mockResolvedValue(ok(null));
  api.disconnectWardConnection.mockResolvedValue(ok(null));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('피보호자 내 가족 (Chrome)', () => {
  it('받은 요청은 이름(관계)만 보이고 수락 전 연락처는 보이지 않는다', async () => {
    api.getWardPendingConnections.mockResolvedValue(ok([request()]));
    api.getWardActiveConnections.mockResolvedValue(ok([]));
    const screen = render(<WardGuardiansPanel />, { wrapper });

    const requests = screen.getByRole('list', { name: '받은 연결 요청' });
    await expect.element(requests).toHaveTextContent('박철수 (손자)');
    await expect.element(requests).toHaveTextContent('보호자가 되고 싶다고 요청했어요');
    expect(requests.element().textContent).not.toContain('010');
    await expect.element(screen.getByText('아직 연결된 보호자가 없어요')).toBeInTheDocument();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('받은 요청을 수락·거절한다(확인 창 없이)', async () => {
    api.getWardPendingConnections.mockResolvedValue(ok([request(), request({ id: 2, partnerName: '박영철' })]));
    api.getWardActiveConnections.mockResolvedValue(ok([]));
    const screen = render(<WardGuardiansPanel />, { wrapper });

    await screen.getByRole('button', { name: '수락' }).first().click();
    await vi.waitFor(() => expect(api.acceptWardConnection.mock.calls[0]?.[0]).toBe(1));
    await screen.getByRole('button', { name: '거절' }).nth(1).click();
    await vi.waitFor(() => expect(api.refuseWardConnectionRequest.mock.calls[0]?.[0]).toBe(2));
  });

  it('보호자 카드는 "이름 (관계)"와 4줄, 연결 끊기는 확인 창을 거친다', async () => {
    api.getWardPendingConnections.mockResolvedValue(ok([]));
    api.getWardActiveConnections.mockResolvedValue(ok([guardian()]));
    const screen = render(<WardGuardiansPanel />, { wrapper });

    const card = screen.getByRole('list', { name: '연결된 보호자' });
    await expect.element(card).toHaveTextContent('박민수 (아들)');
    await expect.element(card).toHaveTextContent('2026년 1월 12일');
    await expect.element(card).toHaveTextContent('kP7mQ2');

    await screen.getByRole('button', { name: '연결 끊기' }).click();
    const dialog = screen.getByRole('dialog');
    await expect.element(dialog).toHaveTextContent('박민수와 연결을 끊을까요?');
    await expect.element(dialog).toHaveTextContent('끊으면 SOS를 눌러도 이 분께 알림이 가지 않아요');
    await dialog.getByRole('button', { name: '그대로 두기' }).click();
    expect(api.disconnectWardConnection).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: '연결 끊기' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: '끊기' }).click();
    await vi.waitFor(() => expect(api.disconnectWardConnection.mock.calls[0]?.[0]).toBe(21));
  });
});
