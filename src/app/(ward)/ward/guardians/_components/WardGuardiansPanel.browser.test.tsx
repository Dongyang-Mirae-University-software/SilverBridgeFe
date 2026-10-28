// 피보호자 "내 가족" 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { IConnectionItem } from '@/service/interface/connection';
import { applyWardConnectionRequestCancelled } from '@/service/query/ward/connection';
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

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={newClient()}>{children}</QueryClientProvider>;
}

function wrapperWith(client: QueryClient) {
  return function ClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
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

  it('보호자 목록은 이름·관계·전화번호 한 줄이고, 연결 끊기는 확인 창을 거친다', async () => {
    api.getWardPendingConnections.mockResolvedValue(ok([]));
    api.getWardActiveConnections.mockResolvedValue(ok([guardian()]));
    const screen = render(<WardGuardiansPanel />, { wrapper });

    const list = screen.getByRole('list', { name: '연결된 보호자' });
    await expect.element(list).toHaveTextContent('박민수 님 (아들)');
    await expect.element(list).toHaveTextContent('010-1234-5678');
    expect(list.element().textContent).not.toContain('2026년 1월 12일');
    expect(list.element().textContent).not.toContain('kP7mQ2');

    await screen.getByRole('button', { name: '연결 끊기' }).click();
    const dialog = screen.getByRole('dialog');
    await expect.element(dialog).toHaveTextContent('박민수 님과 연결을 끊을까요?');
    await expect.element(dialog).toHaveTextContent('끊으면 SOS를 눌러도 이 분께 알림이 가지 않아요');
    await dialog.getByRole('button', { name: '그대로 두기' }).click();
    expect(api.disconnectWardConnection).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: '연결 끊기' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: '끊기' }).click();
    await vi.waitFor(() => expect(api.disconnectWardConnection.mock.calls[0]?.[0]).toBe(21));
  });

  // 점검 M-2: 창이 열린 사이 마지막 보호자가 먼저 해제하면 창이 닫히고, 나중에 새 보호자가 연결돼도 옛 창이 다시 뜨지 않는다
  it('확인 창 대상이 목록에서 사라지면 닫히고, 새 보호자가 생겨도 옛 창이 다시 뜨지 않는다', async () => {
    const client = newClient();
    api.getWardPendingConnections.mockResolvedValue(ok([]));
    api.getWardActiveConnections
      .mockResolvedValueOnce(ok([guardian()]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValue(ok([guardian({ id: 22, partnerName: '박지영', relation: '딸' })]));
    const screen = render(<WardGuardiansPanel />, { wrapper: wrapperWith(client) });

    await screen.getByRole('button', { name: '연결 끊기' }).click();
    await expect.element(screen.getByRole('dialog')).toBeInTheDocument();

    await client.invalidateQueries();
    await expect.element(screen.getByText('아직 연결된 보호자가 없어요')).toBeInTheDocument();

    await client.invalidateQueries();
    await expect.element(screen.getByText('박지영')).toBeInTheDocument();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(api.disconnectWardConnection).not.toHaveBeenCalled();
  });

  it('목록을 못 불러오면 그렇다고 알린다', async () => {
    api.getWardPendingConnections.mockRejectedValue(new Error('x'));
    api.getWardActiveConnections.mockRejectedValue(new Error('x'));
    const screen = render(<WardGuardiansPanel />, { wrapper });

    await expect.element(screen.getByText('받은 연결 요청을 불러오지 못했어요.')).toBeInTheDocument();
    await expect.element(screen.getByText('보호자 목록을 불러오지 못했어요.')).toBeInTheDocument();
  });
});

describe('보호자 요청 취소 신호 (connection-request-cancelled)', () => {
  it('토스트 없이 받은 요청 목록만 새로 받고, 다른 신호는 넘긴다', () => {
    const client = newClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    expect(applyWardConnectionRequestCancelled(client, { type: 'CONNECTION_REQUEST_CANCELLED', connectionId: '3' })).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ward-connections'] });

    invalidate.mockClear();
    expect(applyWardConnectionRequestCancelled(client, { type: 'CONNECTION_REQUEST' })).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
