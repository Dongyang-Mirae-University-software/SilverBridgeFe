// 보호자 가족 등록·수락 대기·연결된 가족 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

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
  previewWardConnection: vi.fn(),
}));

const userApi = vi.hoisted(() => ({ getMyProfile: vi.fn() }));
vi.mock('@/service/api/user/user', async importOriginal => ({
  ...(await importOriginal<object>()),
  ...userApi,
}));

// next/link는 브라우저 테스트에서 process를 찾으므로 일반 a로 바꾼다(가족 등록 타일)
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// 가족 등록 링크(?targetId=)를 읽는 폼이라 빈 쿼리를 준다
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

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
  api.previewWardConnection.mockResolvedValue({ targetId: 'aB3x9Z', maskedName: '김*희' });
  userApi.getMyProfile.mockReset();
  userApi.getMyProfile.mockResolvedValue(ok({ name: '이보호' }));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('가족 등록 폼 - 한 장씩 묻기 (Chrome)', () => {
  type Screen = Awaited<ReturnType<typeof render>>;
  const next = (screen: Screen) => screen.getByRole('button', { name: '다음', exact: true });
  const back = (screen: Screen) => screen.getByRole('button', { name: '이전', exact: true });
  const send = (screen: Screen) => screen.getByRole('button', { name: '연결 요청 보내기' });
  const title = (screen: Screen) => screen.getByRole('heading', { level: 2 });

  async function fillId(screen: Screen, id: string) {
    await userEvent.fill(screen.getByLabelText('어르신의 회원 ID').element() as HTMLInputElement, id);
  }

  async function goToLastStep(screen: Screen, id = 'aB3x9Z', wardRelation = '엄마', relation = '아들') {
    await fillId(screen, id);
    await next(screen).click();
    await screen.getByRole('radio', { name: wardRelation, exact: true }).click();
    await next(screen).click();
    await screen.getByRole('radio', { name: relation, exact: true }).click();
  }

  it('세 단계를 차례로 묻고, 각 단계는 골라야 [다음]이 켜지며 1단계에는 [이전]이 없다', async () => {
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });

    await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
    await expect.element(screen.getByRole('img', { name: '3단계 중 1단계' })).toBeInTheDocument();
    expect(back(screen).query()).toBeNull();
    await expect.element(next(screen)).toBeDisabled();
    await fillId(screen, 'aB3x9Z');
    await expect.element(next(screen)).toBeEnabled();
    await next(screen).click();

    await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
    await expect.element(screen.getByRole('img', { name: '3단계 중 2단계' })).toBeInTheDocument();
    expect(screen.getByRole('radio').elements()).toHaveLength(12);
    await expect.element(next(screen)).toBeDisabled();
    await screen.getByRole('radio', { name: '엄마', exact: true }).click();
    await next(screen).click();

    await expect.element(title(screen)).toHaveTextContent('어르신께 나는 누구인가요?');
    expect(screen.getByRole('radio').elements()).toHaveLength(9);
    expect(next(screen).query()).toBeNull();
    await expect.element(send(screen)).toBeDisabled();
    await screen.getByRole('radio', { name: '아들', exact: true }).click();
    await expect.element(send(screen)).toBeEnabled();
    expectNoHorizontalScroll();
  });

  it('단계를 옮기면 새 질문 제목으로 초점이 간다', async () => {
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await fillId(screen, 'aB3x9Z');
    await next(screen).click();

    await expect.element(title(screen)).toHaveFocus();
  });

  it('[이전]으로 돌아가도 고른 값과 회원 ID가 남는다', async () => {
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '외할머니', '손녀');

    await back(screen).click();
    await expect.element(screen.getByRole('radio', { name: '외할머니', exact: true })).toBeChecked();
    await back(screen).click();
    await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('aB3x9Z');
    await next(screen).click();
    await next(screen).click();
    await expect.element(screen.getByRole('radio', { name: '손녀', exact: true })).toBeChecked();
  });

  it('방향이 뒤바뀌지 않는다 - 2단계(호칭) 엄마 + 3단계(나) 아들 → relation 아들·wardRelation 엄마', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '엄마', '아들');
    await send(screen).click();

    expect(api.requestWardConnection.mock.calls[0]?.[0]).toEqual({ relation: '아들', wardRelation: '엄마', targetId: 'aB3x9Z' });
  });

  it('조카를 고를 수 있고 그대로 보낸다', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '이모', '조카');
    await send(screen).click();

    expect(api.requestWardConnection.mock.calls[0]?.[0]).toEqual({ relation: '조카', wardRelation: '이모', targetId: 'aB3x9Z' });
  });

  it('미리보기는 양쪽 화면에 실제로 보일 모습을 보여 준다', async () => {
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    const mine = () => screen.getByTestId('preview-my-screen');
    const theirs = () => screen.getByTestId('preview-ward-screen');
    await fillId(screen, 'aB3x9Z');
    await next(screen).click();

    await expect.element(mine()).toHaveTextContent('(고르면 보여요)');
    await screen.getByRole('radio', { name: '할머니', exact: true }).click();
    await expect.element(mine()).toHaveTextContent('김*희 할머니');
    // 기타는 보호자 화면에서 "어르신"으로 보인다
    await screen.getByRole('radio', { name: '기타', exact: true }).click();
    await expect.element(mine()).toHaveTextContent('김*희 어르신');
    await expect.element(theirs()).toHaveTextContent('이보호 보호자 (고르면 보여요)');

    await next(screen).click();
    await screen.getByRole('radio', { name: '딸', exact: true }).click();
    await expect.element(theirs()).toHaveTextContent('이보호 보호자 (딸)');
    // 어르신 화면은 기타도 그대로 "(기타)"로 보인다
    await screen.getByRole('radio', { name: '기타', exact: true }).click();
    await expect.element(theirs()).toHaveTextContent('이보호 보호자 (기타)');
  });

  it('회원 ID는 영문·숫자 6자리만 받고 대소문자 그대로 요청한다', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB-3x 9Z');
    await send(screen).click();

    expect(api.requestWardConnection.mock.calls[0]?.[0]).toEqual({ relation: '아들', wardRelation: '엄마', targetId: 'aB3x9Z' });
  });

  it('보내면 완료 화면을 보여 준다 - 요청한 어르신, 진행 완료, [이전]·미리보기 없음', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '엄마', '아들');
    await send(screen).click();

    await expect.element(title(screen)).toHaveTextContent('연결 요청을 보냈어요');
    await expect.element(title(screen)).toHaveFocus();
    await expect.element(screen.getByText('김*희 엄마', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByRole('img', { name: '3단계를 모두 마쳤어요' })).toBeInTheDocument();
    // 두 문장은 한 줄씩 따로 보인다
    await expect.element(screen.getByText('어르신이 수락하면 연결돼요.', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText('연결된 가족 화면에서 확인할 수 있어요.', { exact: true })).toBeInTheDocument();
    const [first, second] = ['어르신이 수락하면 연결돼요.', '연결된 가족 화면에서 확인할 수 있어요.'].map(text =>
      screen.getByText(text, { exact: true }).element().getBoundingClientRect(),
    );
    expect(first.bottom).toBeLessThanOrEqual(second.top);
    expect(back(screen).query()).toBeNull();
    expect(screen.getByTestId('preview-my-screen').query()).toBeNull();
    expect(screen.getByLabelText('어르신의 회원 ID').query()).toBeNull();
    await expect.element(screen.getByRole('link', { name: '연결된 가족 보기' })).toHaveAttribute('href', '/guardian/wards');
    expectNoHorizontalScroll();
  });

  it('완료 화면의 호칭도 기타면 "어르신", 이름 확인이 안 됐으면 호칭만 보인다', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    api.previewWardConnection.mockRejectedValue(new Error('확인 실패'));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '기타', '아들');
    await send(screen).click();

    await expect.element(screen.getByText('어르신', { exact: true })).toBeInTheDocument();
  });

  it('[다른 어르신 등록하기]는 모든 값을 비우고 1단계로 돌아간다', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '엄마', '아들');
    await send(screen).click();
    await screen.getByRole('button', { name: '다른 어르신 등록하기' }).click();

    await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
    await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('');
    await expect.element(screen.getByRole('img', { name: '3단계 중 1단계' })).toBeInTheDocument();
    await fillId(screen, 'aB3x9Z');
    await next(screen).click();
    await expect.element(screen.getByRole('radio', { name: '엄마', exact: true })).not.toBeChecked();
  });

  it('실패하면 완료 화면으로 가지 않는다', async () => {
    api.requestWardConnection.mockRejectedValue(apiError(404, 'USER_NOT_FOUND'));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen);
    await send(screen).click();

    await expect.element(screen.getByRole('alert')).toBeInTheDocument();
    await expect.element(title(screen)).toHaveTextContent('어르신께 나는 누구인가요?');
    expect(screen.getByRole('link', { name: '연결된 가족 보기' }).query()).toBeNull();
  });

  it('완료 화면도 글자를 두 배로 키워 좁은 화면에서 가로로 넘치지 않는다', async () => {
    api.requestWardConnection.mockResolvedValue(ok(null));
    document.documentElement.style.fontSize = '200%';
    try {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await goToLastStep(screen, 'aB3x9Z', '외할아버지', '배우자');
      await send(screen).click();
      await expect.element(title(screen)).toHaveTextContent('연결 요청을 보냈어요');
      expectNoHorizontalScroll();
      // 좁은 화면에서 두 버튼은 세로로 쌓이고 주 버튼(연결된 가족 보기)이 위에 온다
      const primary = screen.getByRole('link', { name: '연결된 가족 보기' }).element().getBoundingClientRect();
      const secondary = screen.getByRole('button', { name: '다른 어르신 등록하기' }).element().getBoundingClientRect();
      expect(primary.bottom).toBeLessThanOrEqual(secondary.top);
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  it.each([
    [404, 'USER_NOT_FOUND', undefined, '이 회원 ID로 가입한 분이 없어요'],
    [409, 'CONNECTION_ALREADY_EXISTS', undefined, '이미 연결됐거나 수락을 기다리는 중이에요'],
    [400, 'CONNECTION_TARGET_NOT_ACTIVE', undefined, '지금은 연결할 수 없는 계정이에요'],
    [429, 'CONNECTION_REQUEST_COOLDOWN', { retryAfterSeconds: 7260 }, '2시간 1분 뒤에 다시 요청할 수 있어요'],
  ])('%s %s는 코드별 문구로 안내하고 [회원 ID 바꾸기]로 1단계에 가며 관계는 남긴다', async (status, code, data, expected) => {
    api.requestWardConnection.mockRejectedValue(apiError(status, code, data));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen, 'aB3x9Z', '엄마', '손녀');
    await send(screen).click();

    await expect.element(screen.getByRole('alert')).toMatchTextContent(expected);
    await screen.getByRole('button', { name: '회원 ID 바꾸기' }).click();
    await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
    expect(screen.getByRole('alert').query()).toBeNull();
    await next(screen).click();
    await expect.element(screen.getByRole('radio', { name: '엄마', exact: true })).toBeChecked();
    await next(screen).click();
    await expect.element(screen.getByRole('radio', { name: '손녀', exact: true })).toBeChecked();
  });

  it('상대 계정과 무관한 실패는 문구만 보이고 [회원 ID 바꾸기]는 없다', async () => {
    api.requestWardConnection.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await goToLastStep(screen);
    await send(screen).click();

    await expect.element(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '회원 ID 바꾸기' }).query()).toBeNull();
  });

  it('글자를 두 배로 키워도 가로로 넘치지 않는다', async () => {
    document.documentElement.style.fontSize = '200%';
    try {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await goToLastStep(screen, 'aB3x9Z', '외할아버지', '배우자');
      expectNoHorizontalScroll();
    } finally {
      document.documentElement.style.fontSize = '';
    }
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
    const screen = await render(<GuardianConnectionRequestHistory />, { wrapper });

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
    const screen = await render(<GuardianConnectionRequestHistory />, { wrapper });

    await screen.getByRole('button', { name: '요청 취소' }).click();
    await expect.element(screen.getByRole('alert')).toMatchTextContent('이미 수락되었거나 거절된 요청이에요.');
    await expect.element(screen.getByText('수락을 기다리는 중')).not.toBeInTheDocument();
  });

  it('보낸 요청을 못 불러오면 그렇다고 알린다', async () => {
    api.getGuardianConnectionRequests.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
    const screen = await render(<GuardianConnectionRequestHistory />, { wrapper });
    await expect.element(screen.getByText('보낸 요청을 불러오지 못했어요.')).toBeInTheDocument();
  });

  it('대기 요청이 없으면 칸을 그리지 않는다', async () => {
    api.getGuardianConnectionRequests.mockResolvedValue(ok([]));
    const screen = await render(<GuardianConnectionRequestHistory />, { wrapper });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.container.textContent).toBe('');
  });
});

describe('연결된 가족 (Chrome)', () => {
  it('만 나이와 전화번호·주소만 보이고, ACTIVE가 아닌 연결은 가족 카드에 보이지 않는다', async () => {
    api.getGuardianConnections.mockResolvedValue(
      ok([connection(), connection({ id: 8, partnerName: '이순자', status: 'PENDING', partnerPhone: null })]),
    );
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

    // relation은 보호자가 어르신에게 누구인지라 "아들로 연결됨"으로 나이 뒤에 붙는다
    await expect.element(screen.getByText(/^만 \d+세 · 아들로 연결됨$/)).toBeInTheDocument();
    await expect.element(screen.getByText('010-9876-5432')).toBeInTheDocument();
    await expect.element(screen.getByText('서울 송파구 올림픽로 456, 102동 1503호')).toBeInTheDocument();
    await expect.element(screen.getByText('1명')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('여성');
    expect(document.body.textContent).not.toContain('05551');
    expect(screen.getByText('이메일').query()).toBeNull();
    expect(screen.getByText('성별 · 생년월일').query()).toBeNull();
    expect(screen.getByText('회원 ID').query()).toBeNull();
    expect(document.body.textContent).not.toContain('이순자');
    expectNoHorizontalScroll();
  });

  it('연결 해제는 확인 창을 거친다 - 취소하면 부르지 않고, 확인하면 부른다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    api.disconnectGuardianConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

    await screen.getByRole('button', { name: '연결 해제' }).click();
    const dialog = screen.getByRole('dialog');
    await expect.element(dialog).toMatchTextContent('김영희 님과의 연결을 해제하면');
    await dialog.getByRole('button', { name: '취소' }).click();
    expect(api.disconnectGuardianConnection).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: '연결 해제' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: '연결 해제' }).click();
    expect(api.disconnectGuardianConnection.mock.calls[0]?.[0]).toEqual(7);
  });

  it('목록을 못 불러오면 그렇다고 알린다', async () => {
    api.getGuardianConnections.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });
    await expect.element(screen.getByText('연결된 가족을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('명', { exact: false }).query()).toBeNull();
  });

  it('불러오는 동안은 그렇다고 알리고 인원수·등록 타일을 그리지 않는다', async () => {
    api.getGuardianConnections.mockReturnValue(new Promise(() => {}));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });
    await expect.element(screen.getByText('연결된 가족을 불러오는 중입니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가족 등록' }).query()).toBeNull();
  });

  it('연결된 가족이 없으면 안내 문구와 가족 등록 타일을 보인다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([]));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });
    await expect.element(screen.getByText('아직 연결된 가족이 없습니다.')).toBeInTheDocument();
    await expect.element(screen.getByText('0명')).toBeInTheDocument();
    await expect.element(screen.getByRole('link', { name: '가족 등록' })).toHaveAttribute('href', '/guardian/wards/register');
    expectNoHorizontalScroll();
  });

  it.each([
    ['엄마', '김영희 엄마'],
    ['기타', '김영희 어르신'],
  ])('어르신 호칭 %s → 카드에 "%s"', async (wardRelation, expected) => {
    api.getGuardianConnections.mockResolvedValue(ok([connection({ wardRelation })]));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

    await expect.element(screen.getByRole('listitem').first()).toMatchTextContent(expected);
  });

  it('사진·연락처가 없으면 이름 첫 글자를 보이고 연락처 칸과 나이 줄을 숨긴다', async () => {
    api.getGuardianConnections.mockResolvedValue(
      ok([connection({ partnerPhone: null, partnerAddress: null, partnerAddressDetail: null, partnerBirthDate: null })]),
    );
    const screen = await render(<GuardianWardsListPanel />, { wrapper });
    const card = screen.getByRole('listitem').first();
    // 어르신 호칭이 없는 기존 연결은 "어르신"
    await expect.element(card).toMatchTextContent('김영희 어르신');
    expect(card.element().querySelector('img')).toBeNull();
    expect(card.element().textContent).toContain('김');
    expect(card.element().textContent).not.toContain('만 ');
    expect(card.element().textContent).not.toContain('-');
  });

  it('수락을 기다리는 요청은 같은 그리드 안 점선 카드로 보이고 연락처 없이 요청 취소를 부른다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    api.getGuardianConnectionRequests.mockResolvedValue(
      ok([connection({ id: 3, partnerName: '최복순', status: 'PENDING', partnerPhone: '010****5432', connectedAt: null })]),
    );
    api.cancelGuardianConnectionRequest.mockResolvedValue(ok(null));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

    const grid = screen.getByRole('list', { name: '연결된 가족' });
    await expect.element(grid).toMatchTextContent('최복순');
    await expect.element(grid).toMatchTextContent('아들로 요청 · 5월 8일');
    await expect.element(grid).toMatchTextContent('수락을 기다리는 중');
    expect(grid.element().textContent).not.toContain('010****5432');
    // 인원수는 연결된(ACTIVE) 가족만 센다
    await expect.element(screen.getByText('1명')).toBeInTheDocument();

    await grid.getByRole('button', { name: '요청 취소' }).click();
    expect(api.cancelGuardianConnectionRequest.mock.calls[0]?.[0]).toEqual(3);
  });

  it('요청 취소 실패(409)는 목록 위 한 줄로 안내한다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([]));
    api.getGuardianConnectionRequests.mockResolvedValue(ok([connection({ id: 3, status: 'PENDING', connectedAt: null })]));
    api.cancelGuardianConnectionRequest.mockRejectedValue(apiError(409, 'CONNECTION_NOT_PENDING'));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

    await screen.getByRole('button', { name: '요청 취소' }).click();
    await expect.element(screen.getByRole('alert')).toMatchTextContent('이미 수락되었거나 거절된 요청이에요.');
  });

  // 점검 L-1: 포커스는 창 안 "취소"로 들어가고, Esc로 닫으면 누른 버튼으로 돌아온다
  it('확인 창은 포커스를 안으로 옮기고 Esc로 닫으면 연 버튼으로 돌려준다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

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
    const screen = await render(<GuardianWardsListPanel />, { wrapper: wrapperWith(client) });

    await screen.getByRole('button', { name: '연결 해제' }).click();
    await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
    await client.invalidateQueries();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(api.disconnectGuardianConnection).not.toHaveBeenCalled();
  });

  it('이미 해제된 연결(409)은 사실대로 안내한다', async () => {
    api.getGuardianConnections.mockResolvedValue(ok([connection()]));
    api.disconnectGuardianConnection.mockRejectedValue(apiError(409, 'CONNECTION_NOT_ACTIVE'));
    const screen = await render(<GuardianWardsListPanel />, { wrapper });

    await screen.getByRole('button', { name: '연결 해제' }).click();
    await screen.getByRole('dialog').getByRole('button', { name: '연결 해제' }).click();
    await expect.element(screen.getByRole('alert')).toMatchTextContent('이미 연결이 해제됐어요.');
  });
});
