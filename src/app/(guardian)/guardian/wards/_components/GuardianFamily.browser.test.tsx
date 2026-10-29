// 보호자 가족 등록·수락 대기·연결된 가족 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from '@vitest/browser/context';

import type { IConnectionItem } from '@/service/interface/connection';
import { GuardianConnectionRequestForm } from './GuardianConnectionRequestForm';
import { GuardianConnectionRequestHistory } from './GuardianConnectionRequestHistory';
import { GuardianWardsListPanel } from './GuardianWardsListPanel';

const api = vi.hoisted(() => ({
  requestWardConnection: vi.fn(),
  getGuardianConnections: vi.fn(),
  getGuardianConnectionRequests: vi.fn(),
  cancelGuardianConnectionRequest: vi.fn(),
  disconnectGuardianConnection: vi.fn(),
}));

vi.mock('@/service/api/guardian/connection', async importOriginal => ({
  ...(await importOriginal<object>()),
  ...api,
}));

function connection(overrides: Partial<IConnectionItem> = {}): IConnectionItem {
  return {
    id: 7,
    partnerUserId: 'aB3x9Z',
    partnerName: '김영희',
    partnerProfileImage: null,
    partnerPhone: '01098765432',
    partnerAddress: '서울 송파구 올림픽로 456',
    partnerAddressDetail: '102동 1503호',
    partnerPostcode: '05551',
    partnerGender: 'FEMALE',
    partnerBirthDate: '1948-03-15',
    partnerEmail: 'younghee@example.com',
    relation: '아들',
    status: 'ACTIVE',
    connectedAt: '2026-05-08T09:00:00+09:00',
    createdAt: '2026-05-08T09:00:00+09:00',
    ...overrides,
  };
}

function ok<T>(data: T) {
  return { code: 200, success: true, data };
}

function apiError(status: number, code: string, data?: unknown) {
  return Object.assign(new Error('서버 문구'), { response: { status, data: { code, message: '서버 문구', data } } });
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

function expectNoHorizontalScroll() {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
}

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.getGuardianConnectionRequests.mockResolvedValue(ok([]));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('가족 등록 폼 (Chrome)', () => {
  async function fillForm(screen: ReturnType<typeof render>, id: string, relation = '아들') {
    await userEvent.fill(screen.getByLabelText('어르신의 회원 ID').element() as HTMLInputElement, id);
    await screen.getByRole('button', { name: relation }).click();
  }

  it('회원 ID는 영문·숫자 6자리만 받고 대소문자 그대로 요청한다', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = render(<GuardianConnectionRequestForm />, { wrapper });
    const submit = screen.getByRole('button', { name: '연결 요청 보내기' });

    await expect.element(submit).toBeDisabled();
    await fillForm(screen, 'aB-3x 9Z');
    await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('aB3x9Z');
    await expect.element(submit).toBeEnabled();
    await submit.click();

    expect(api.requestWardConnection.mock.calls[0]?.[0]).toEqual({ relation: '아들', targetId: 'aB3x9Z' });
    await expect.element(screen.getByText('연결 요청을 보냈어요. 어르신이 수락하면 연결돼요')).toBeInTheDocument();
    expectNoHorizontalScroll();
  });

  it.each([
    [404, 'USER_NOT_FOUND', undefined, '이 회원 ID로 가입한 분이 없어요'],
    [409, 'CONNECTION_ALREADY_EXISTS', undefined, '이미 연결됐거나 수락을 기다리는 중이에요'],
    [400, 'CONNECTION_TARGET_NOT_ACTIVE', undefined, '지금은 연결할 수 없는 계정이에요'],
    [429, 'CONNECTION_REQUEST_COOLDOWN', { retryAfterSeconds: 7260 }, '2시간 1분 뒤에 다시 요청할 수 있어요'],
  ])('%s %s는 코드별 문구로 안내한다', async (status, code, data, expected) => {
    api.requestWardConnection.mockRejectedValue(apiError(status, code, data));
    const screen = render(<GuardianConnectionRequestForm />, { wrapper });

    await fillForm(screen, 'aB3x9Z', '손녀');
    await screen.getByRole('button', { name: '연결 요청 보내기' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent(expected);
  });
});

describe('수락을 기다리는 중 (Chrome)', () => {
  it('이름·관계·요청일과 프로필을 보이고 상대 연락처는 보이지 않는다, 요청 취소를 부른다', async () => {
    api.getGuardianConnectionRequests.mockResolvedValue(
      ok([
        connection({ id: 3, status: 'PENDING', partnerPhone: '010****5432', partnerName: '김영희', connectedAt: null }),
        connection({ id: 4, status: 'REFUSED' }),
      ]),
    );
    api.cancelGuardianConnectionRequest.mockResolvedValue(ok(null));
    const screen = render(<GuardianConnectionRequestHistory />, { wrapper });

    await expect.element(screen.getByText('김영희')).toBeInTheDocument();
    await expect.element(screen.getByText('아들로 요청 · 5월 8일')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('010');
    expect(screen.getByRole('button', { name: '요청 취소' }).elements()).toHaveLength(1);

    await screen.getByRole('button', { name: '요청 취소' }).click();
    expect(api.cancelGuardianConnectionRequest.mock.calls[0]?.[0]).toEqual(3);
  });

  // 점검 M-1: 피보호자가 먼저 수락·거절해 취소가 409면, 빈 칸 없이 사실대로 한 줄만 안내한다
  it('취소 실패(409)는 빈 칸을 붙들지 않고 "이미 수락되었거나 거절된 요청"으로 안내한다', async () => {
    api.getGuardianConnectionRequests
      .mockResolvedValueOnce(ok([connection({ id: 3, status: 'PENDING', connectedAt: null })]))
      .mockResolvedValue(ok([connection({ id: 3, status: 'ACTIVE' })]));
    api.cancelGuardianConnectionRequest.mockRejectedValue(apiError(409, 'CONNECTION_NOT_PENDING'));
    const screen = render(<GuardianConnectionRequestHistory />, { wrapper });

    await screen.getByRole('button', { name: '요청 취소' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('이미 수락되었거나 거절된 요청이에요.');
    await expect.element(screen.getByText('수락을 기다리는 중')).not.toBeInTheDocument();
  });

  it('보낸 요청을 못 불러오면 그렇다고 알린다', async () => {
    api.getGuardianConnectionRequests.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
    const screen = render(<GuardianConnectionRequestHistory />, { wrapper });
    await expect.element(screen.getByText('보낸 요청을 불러오지 못했어요.')).toBeInTheDocument();
  });

  it('대기 요청이 없으면 칸을 그리지 않는다', async () => {
    api.getGuardianConnectionRequests.mockResolvedValue(ok([]));
    const screen = render(<GuardianConnectionRequestHistory />, { wrapper });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.container.textContent).toBe('');
  });
});

describe('연결된 가족 (Chrome)', () => {
  it('만 나이·성별과 전화번호·주소만 보이고, ACTIVE가 아닌 연결은 가족 카드에 보이지 않는다', async () => {
    api.getGuardianConnections.mockResolvedValue(
      ok([connection(), connection({ id: 8, partnerName: '이순자', status: 'PENDING', partnerPhone: null })]),
    );
    const screen = render(<GuardianWardsListPanel />, { wrapper });

    await expect.element(screen.getByText(/^만 \d+세 · 여성$/)).toBeInTheDocument();
    await expect.element(screen.getByText('(05551) 서울 송파구 올림픽로 456 102동 1503호')).toBeInTheDocument();
    expect(screen.getByText('이메일').query()).toBeNull();
    expect(screen.getByText('성별 · 생년월일').query()).toBeNull();
    expect(screen.getByText('회원 ID').query()).toBeNull();
    expect(document.body.textContent).not.toContain('이순자');
    expectNoHorizontalScroll();
  });

  it('연결 해제는 확인 창을 거친다 - 취소하면 부르지 않고, 확인하면 부른다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    api.disconnectGuardianConnection.mockResolvedValue(ok(null));
    const screen = render(<GuardianWardsListPanel />, { wrapper });

    await screen.getByRole('button', { name: '연결 해제' }).click();
    const dialog = screen.getByRole('dialog');
    await expect.element(dialog).toHaveTextContent('김영희 님과의 연결을 해제하면');
    await dialog.getByRole('button', { name: '취소' }).click();
    expect(api.disconnectGuardianConnection).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: '연결 해제' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: '연결 해제' }).click();
    expect(api.disconnectGuardianConnection.mock.calls[0]?.[0]).toEqual(7);
  });

  it('목록을 못 불러오면 그렇다고 알린다', async () => {
    api.getGuardianConnections.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
    const screen = render(<GuardianWardsListPanel />, { wrapper });
    await expect.element(screen.getByText('연결된 가족을 불러오지 못했습니다.')).toBeInTheDocument();
  });

  // 점검 L-1: 포커스는 창 안 "취소"로 들어가고, Esc로 닫으면 누른 버튼으로 돌아온다
  it('확인 창은 포커스를 안으로 옮기고 Esc로 닫으면 연 버튼으로 돌려준다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    const screen = render(<GuardianWardsListPanel />, { wrapper });

    const opener = screen.getByRole('button', { name: '연결 해제' });
    await opener.click();
    await expect.element(screen.getByRole('dialog').getByRole('button', { name: '취소' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });

  // 점검 M-2: 창이 열린 사이 상대가 먼저 해제해 목록에서 빠지면 창도 닫힌다
  it('확인 창이 열린 채 대상이 목록에서 사라지면 창을 닫는다', async () => {
    const client = newClient();
    api.getGuardianConnections.mockResolvedValueOnce(ok([connection()])).mockResolvedValue(ok([]));
    const screen = render(<GuardianWardsListPanel />, { wrapper: wrapperWith(client) });

    await screen.getByRole('button', { name: '연결 해제' }).click();
    await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
    await client.invalidateQueries();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(api.disconnectGuardianConnection).not.toHaveBeenCalled();
  });

  it('이미 해제된 연결(409)은 사실대로 안내한다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    api.disconnectGuardianConnection.mockRejectedValue(apiError(409, 'CONNECTION_NOT_ACTIVE'));
    const screen = render(<GuardianWardsListPanel />, { wrapper });

    await screen.getByRole('button', { name: '연결 해제' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: '연결 해제' }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('이미 연결이 해제됐어요.');
  });
});
