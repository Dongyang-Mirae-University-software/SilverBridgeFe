// 보호자 가족 등록·수락 대기·연결된 가족 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

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

// 가족 등록 링크(?targetId=)를 읽는 폼이라 쿼리를 준다(기본은 빈 쿼리, 링크로 들어온 경우만 채운다)
const nav = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));

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
  // 테스트는 한 페이지에서 차례로 돈다 - 앞 테스트의 단계 기록 위에서 폼이 열리면 되감기(H-1)가 일어나므로 빈 기록에서 시작한다
  window.history.pushState({ testBoundary: true }, '');
  nav.query = '';
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

  describe('하단 버튼은 낮은 휴대폰 화면에서도 잘리지 않는다 (375×600)', () => {
    beforeEach(async () => {
      await page.viewport(375, 600);
      window.scrollTo(0, 0);
    });
    afterEach(async () => {
      document.documentElement.style.fontSize = '';
      await page.viewport(375, 812);
    });

    const fullyVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    };
    const scrollToEnd = () => window.scrollTo(0, document.documentElement.scrollHeight);

    async function openStep2(screen: Screen) {
      await fillId(screen, 'aB3x9Z');
      await next(screen).click();
      window.scrollTo(0, 0);
    }

    it('2단계: 스크롤하지 않아도 [다음]이 다 보이고, 끝까지 내려도 마지막 보기가 버튼 줄에 가려지지 않는다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await openStep2(screen);

      expect(fullyVisible(next(screen).element())).toBe(true);
      scrollToEnd();
      const footer = next(screen).element().closest('footer')!;
      // 붙은 버튼 줄 뒤로 지나가는 목록이 비쳐 보이지 않게 배경이 있어야 한다
      expect(getComputedStyle(footer).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      for (const name of ['고모', '기타']) {
        const row = screen.getByRole('radio', { name, exact: true }).element().closest('label')!;
        expect(row.getBoundingClientRect().bottom).toBeLessThanOrEqual(footer.getBoundingClientRect().top);
      }
    });

    it('2단계 도움말은 없다 - 기타는 미리보기가 "어르신"으로 보여 준다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await openStep2(screen);

      expect(screen.getByText(/기타를 고르면/).query()).toBeNull();
      await screen.getByRole('radio', { name: '기타', exact: true }).click();
      await expect.element(screen.getByTestId('preview-my-screen')).toHaveTextContent('김*희 어르신');
    });

    it('3단계 [연결 요청 보내기]와 완료 화면 두 버튼도 다 보인다', async () => {
      api.requestWardConnection.mockResolvedValue(ok(null));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await goToLastStep(screen);
      window.scrollTo(0, 0);

      expect(fullyVisible(send(screen).element())).toBe(true);
      await send(screen).click();
      await expect.element(title(screen)).toHaveTextContent('연결 요청을 보냈어요');
      window.scrollTo(0, 0);
      expect(fullyVisible(screen.getByRole('link', { name: '연결된 가족 보기' }).element())).toBe(true);
      expect(fullyVisible(screen.getByRole('button', { name: '다른 어르신 등록하기' }).element())).toBe(true);
    });

    it('글자를 두 배로 키워도 [다음]이 다 보인다', async () => {
      document.documentElement.style.fontSize = '200%';
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await openStep2(screen);

      expect(fullyVisible(next(screen).element())).toBe(true);
      expectNoHorizontalScroll();
    });
  });

  describe('선택 목록 배치', () => {
    const rectOf = (screen: Screen, name: string) =>
      screen.getByRole('radio', { name, exact: true }).element().closest('label')!.getBoundingClientRect();
    const longestRow = (screen: Screen) =>
      screen.getByRole('radio', { name: '외할아버지', exact: true }).element().closest('label')!;

    async function openStep2(screen: Screen) {
      await fillId(screen, 'aB3x9Z');
      await next(screen).click();
    }

    it('2단계 보기는 짝이 한 줄에 오는 순서다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await openStep2(screen);

      const names = screen.getByRole('radio').elements().map(el => (el as HTMLInputElement).value);
      expect(names).toEqual(['엄마', '아빠', '할머니', '할아버지', '외할머니', '외할아버지', '남편', '아내', '삼촌', '이모', '고모', '기타']);
    });

    it('좁은 화면에서도 두 칸이고 가장 긴 보기(외할아버지)도 칸 안에 들어간다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await openStep2(screen);

      const [mom, dad, grandma] = ['엄마', '아빠', '할머니'].map(name => rectOf(screen, name));
      expect(dad.top).toBe(mom.top);
      expect(dad.left).toBeGreaterThan(mom.left);
      expect(grandma.top).toBeGreaterThan(mom.top);
      expect(longestRow(screen).scrollWidth).toBeLessThanOrEqual(longestRow(screen).clientWidth);
      expectNoHorizontalScroll();
    });

    // R-4: 칸 수는 1·2·4칸만 - 홀수 칸이면 짝이 줄에서 갈린다
    async function withViewport(width: number, run: () => Promise<void>) {
      await page.viewport(width, 800);
      try {
        await run();
      } finally {
        await page.viewport(375, 812);
      }
    }

    const fieldWidth = (screen: Screen) => screen.getByRole('radiogroup').element().parentElement!.clientWidth;

    it('넓은 화면(PC)에서는 네 칸이고 짝이 같은 줄에 온다(7칸이 되지 않는다)', async () => {
      await withViewport(1280, async () => {
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await openStep2(screen);

        const [mom, dad, grandma, grandpa, outerGrandma, husband, wife] = ['엄마', '아빠', '할머니', '할아버지', '외할머니', '남편', '아내'].map(
          name => rectOf(screen, name),
        );
        expect([dad.top, grandma.top, grandpa.top]).toEqual([mom.top, mom.top, mom.top]);
        expect(outerGrandma.top).toBeGreaterThan(mom.top);
        expect(outerGrandma.left).toBe(mom.left);
        expect(wife.top).toBe(husband.top);
        expect(wife.left).toBeGreaterThan(husband.left);
        expectNoHorizontalScroll();
      });
    });

    it('중간 폭(작은 태블릿)에서는 세 칸이 아니라 두 칸이다', async () => {
      await withViewport(560, async () => {
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await openStep2(screen);
        // 전에는 이 폭(카드 안 448~599px)에서 세 칸이 되어 "할머니"가 엄마·아빠 줄에 붙었다
        expect(fieldWidth(screen)).toBeGreaterThanOrEqual(448);
        expect(fieldWidth(screen)).toBeLessThan(600);

        const [mom, dad, grandma] = ['엄마', '아빠', '할머니'].map(name => rectOf(screen, name));
        expect(dad.top).toBe(mom.top);
        expect(grandma.top).toBeGreaterThan(mom.top);
        expect(grandma.left).toBe(mom.left);
      });
    });

    it('글자를 두 배로 키우면 한 칸으로 돌아가고 넘치지 않는다', async () => {
      document.documentElement.style.fontSize = '200%';
      try {
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await openStep2(screen);

        const [mom, dad] = ['엄마', '아빠'].map(name => rectOf(screen, name));
        expect(dad.top).toBeGreaterThan(mom.top);
        expect(dad.left).toBe(mom.left);
        expect(longestRow(screen).scrollWidth).toBeLessThanOrEqual(longestRow(screen).clientWidth);
        expectNoHorizontalScroll();
      } finally {
        document.documentElement.style.fontSize = '';
      }
    });
  });

  it('회원 ID 입력칸은 휴대폰 키보드 Enter 자리에 "다음"을 띄운다 (R-5)', async () => {
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveAttribute('enterkeyhint', 'next');
  });

  it('내 이름을 못 불러오면 미리보기는 "나 보호자"가 아니라 "(내 이름) 보호자"다 (R-6)', async () => {
    userApi.getMyProfile.mockRejectedValue(new Error('불러오기 실패'));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await fillId(screen, 'aB3x9Z');
    await next(screen).click();

    const theirs = screen.getByTestId('preview-ward-screen');
    await expect.element(theirs).toHaveTextContent('(내 이름) 보호자 (고르면 보여요)');
    expect(theirs.element().textContent).not.toContain('나 보호자');
  });

  it('미리보기는 고를 때마다 바뀐 줄을 읽어 주는 알림 영역이다 (R-7)', async () => {
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await fillId(screen, 'aB3x9Z');
    await next(screen).click();

    const mine = screen.getByTestId('preview-my-screen');
    expect(mine.element().closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
    await screen.getByRole('radio', { name: '기타', exact: true }).click();
    await expect.element(mine).toHaveTextContent('김*희 어르신');
    // 3단계도 같은 알림 영역을 이어 쓴다
    await next(screen).click();
    expect(screen.getByTestId('preview-ward-screen').element().closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('링크(?targetId=)로 들어와 보낸 뒤 [다른 어르신 등록하기]를 누르면 링크의 ID를 다시 채우지 않는다 (R-8)', async () => {
    nav.query = 'targetId=aB3x9Z';
    api.requestWardConnection.mockResolvedValue(ok(null));
    const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
    await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('aB3x9Z');
    await next(screen).click();
    await screen.getByRole('radio', { name: '엄마', exact: true }).click();
    await next(screen).click();
    await screen.getByRole('radio', { name: '아들', exact: true }).click();
    await send(screen).click();
    expect(api.requestWardConnection.mock.calls[0]?.[0]).toEqual({ relation: '아들', wardRelation: '엄마', targetId: 'aB3x9Z' });

    await screen.getByRole('button', { name: '다른 어르신 등록하기' }).click();
    await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
    await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('');
    await expect.element(next(screen)).toBeDisabled();
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

  describe('브라우저 뒤로 가기 = 이전 질문 (R-1)', () => {
    const historyStep = () => (window.history.state as Record<string, unknown> | null)?.connectionStep;

    it('단계마다 기록을 남기고, 뒤로 가기는 이전 질문으로 가며 고른 값이 남는다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      expect(historyStep()).toBe(1);
      await goToLastStep(screen, 'aB3x9Z', '외할머니', '손녀');
      expect(historyStep()).toBe(3);

      window.history.back();
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
      await expect.element(title(screen)).toHaveFocus();
      await expect.element(screen.getByRole('radio', { name: '외할머니', exact: true })).toBeChecked();
      window.history.back();
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
      await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('aB3x9Z');

      // 앞으로 가기도 단계대로 - 값이 남아 있으니 3단계까지 간다
      window.history.forward();
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
      window.history.forward();
      await expect.element(title(screen)).toHaveTextContent('어르신께 나는 누구인가요?');
      await expect.element(screen.getByRole('radio', { name: '손녀', exact: true })).toBeChecked();
    });

    describe('화면이 새로 열려도 뒤로 가기가 헛돌지 않는다 (H-1)', () => {
      const pageMark = () => (window.history.state as Record<string, unknown> | null)?.mark;

      // 이전 페이지 → 이 화면(기록을 남긴 뒤) → 새로 열림(새로고침·다른 화면에서 돌아옴) → 뒤로 몇 번에 이전 페이지인가
      async function backsToPreviousPage() {
        for (let count = 1; count <= 5; count++) {
          window.history.back();
          await new Promise(resolve => setTimeout(resolve, 250));
          if (pageMark() === 'previous') return count;
        }
        return -1;
      }

      async function openFresh() {
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        // 되감기가 끝나 지금 기록이 이 회차의 1단계가 될 때까지
        await expect.poll(() => (window.history.state as Record<string, unknown>)?.connectionDepth).toBe(0);
        await expect.poll(historyStep).toBe(1);
        return screen;
      }

      it.each([
        ['3단계', 3],
        ['2단계', 2],
      ])('%s에서 새로 열리면 1단계로 시작하고 뒤로 1번에 이전 페이지로 간다', async (_, leaveAt) => {
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const first = await render(<GuardianConnectionRequestForm />, { wrapper });
        await fillId(first, 'aB3x9Z');
        await next(first).click();
        if (leaveAt === 3) {
          await first.getByRole('radio', { name: '엄마', exact: true }).click();
          await next(first).click();
        }
        await expect.poll(historyStep).toBe(leaveAt);
        await first.unmount();

        const screen = await openFresh();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        await expect.element(title(screen)).not.toHaveFocus();
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('새로 열린 뒤 ID를 넣고 앞으로 가도 지난 회차의 단계 기록은 열리지 않는다', async () => {
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const first = await render(<GuardianConnectionRequestForm />, { wrapper });
        await goToLastStep(first);
        await first.unmount();

        const screen = await openFresh();
        await fillId(screen, 'aB3x9Z');
        await expect.element(next(screen)).toBeEnabled();
        // 앞으로 가기에 남은 지난 회차의 2단계 기록 - 값이 있어도 열지 않고 되돌아온다
        window.history.forward();
        await new Promise(resolve => setTimeout(resolve, 400));
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        expect(historyStep()).toBe(1);
        // 이 회차의 2단계로는 [다음]으로 가고, [이전]·뒤로 가기는 기록과 맞게 움직인다
        await next(screen).click();
        await back(screen).click();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('완료 뒤 새로 열려도(연결된 가족 보기 → 뒤로) 뒤로 1번에 이전 페이지로 간다', async () => {
        api.requestWardConnection.mockResolvedValue(ok(null));
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const first = await render(<GuardianConnectionRequestForm />, { wrapper });
        await goToLastStep(first);
        await send(first).click();
        await expect.element(title(first)).toHaveTextContent('연결 요청을 보냈어요');
        await first.unmount();

        await openFresh();
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('보내는 중에 뒤로 가서 2단계가 된 뒤 성공해도 [다른 어르신 등록하기]는 페이지를 떠나지 않는다', async () => {
        let resolve!: (value: unknown) => void;
        api.requestWardConnection.mockReturnValue(new Promise(r => (resolve = r)));
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await goToLastStep(screen);
        await send(screen).click();
        window.history.back();
        await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
        resolve(ok(null));
        await expect.element(title(screen)).toHaveTextContent('연결 요청을 보냈어요');
        // 완료로 덮인 기록은 2단계 자리(깊이 1)다
        expect((window.history.state as Record<string, unknown>).connectionDepth).toBe(1);

        await screen.getByRole('button', { name: '다른 어르신 등록하기' }).click();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        await expect.poll(historyStep).toBe(1);
        expect(pageMark()).toBeUndefined();
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('보통 경우는 그대로 3→2→1→이전 페이지다', async () => {
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await goToLastStep(screen);
        expect(await backsToPreviousPage()).toBe(3);
      });

      it('[다른 어르신 등록하기] 뒤에도 뒤로 1번에 이전 페이지로 간다', async () => {
        api.requestWardConnection.mockResolvedValue(ok(null));
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await goToLastStep(screen);
        await send(screen).click();
        await screen.getByRole('button', { name: '다른 어르신 등록하기' }).click();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        await expect.poll(historyStep).toBe(1);
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('ID를 지우고 앞으로 가면 1단계에 머물고, 뒤로 1번에 이전 페이지로 간다', async () => {
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await fillId(screen, 'aB3x9Z');
        await next(screen).click();
        window.history.back();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        await userEvent.clear(screen.getByLabelText('어르신의 회원 ID').element() as HTMLInputElement);
        window.history.forward();
        await new Promise(resolve => setTimeout(resolve, 300));
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('깊이·회차가 없는 옛 기록 위에서 열려도 깨지지 않는다(되감지 않고 1단계)', async () => {
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({ connectionStep: 3 }, '');
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        await expect.poll(historyStep).toBe(1);
        expect(pageMark()).toBeUndefined();
        expect(await backsToPreviousPage()).toBe(1);
      });
    });

    describe('Next가 기록을 덮어써도 단계 기록이 남는다 (I-1)', () => {
      const pageMark = () => (window.history.state as Record<string, unknown> | null)?.mark;
      // router.refresh()·같은 주소 이동 때 Next가 하는 일 - 지금 기록을 자기 값으로만 다시 쓴다(app-router HistoryUpdater)
      const nextRewrites = (url: string = window.location.href) =>
        window.history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: [] } }, '', url);

      async function backsToPreviousPage() {
        for (let count = 1; count <= 5; count++) {
          window.history.back();
          await new Promise(resolve => setTimeout(resolve, 250));
          if (pageMark() === 'previous') return count;
        }
        return -1;
      }

      async function openOnPreviousPage() {
        window.history.pushState({ mark: 'previous' }, '');
        window.history.pushState({}, '');
        const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
        await expect.poll(historyStep).toBe(1);
        return screen;
      }

      it('1단계에서 덮어써도 2단계의 [이전]·뒤로 가기가 1단계로 돌아온다', async () => {
        const screen = await openOnPreviousPage();
        nextRewrites();
        expect(historyStep()).toBe(1);
        expect((window.history.state as Record<string, unknown>).__NA).toBe(true); // Next 값도 그대로
        await fillId(screen, 'aB3x9Z');
        await next(screen).click();
        await back(screen).click();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');

        await next(screen).click();
        window.history.back();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('2단계에서 덮어써도 3단계의 뒤로 1번에 2단계로 간다', async () => {
        const screen = await openOnPreviousPage();
        await fillId(screen, 'aB3x9Z');
        await next(screen).click();
        nextRewrites();
        expect(historyStep()).toBe(2);
        await screen.getByRole('radio', { name: '엄마', exact: true }).click();
        await next(screen).click();
        window.history.back();
        await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
      });

      it('완료 화면에서 덮어써도 [다른 어르신 등록하기]가 페이지를 떠나지 않는다', async () => {
        api.requestWardConnection.mockResolvedValue(ok(null));
        const screen = await openOnPreviousPage();
        await goToLastStep(screen);
        await send(screen).click();
        await expect.element(title(screen)).toHaveTextContent('연결 요청을 보냈어요');
        nextRewrites();
        expect(historyStep()).toBe('done');
        await screen.getByRole('button', { name: '다른 어르신 등록하기' }).click();
        await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
        await expect.poll(historyStep).toBe(1);
        expect(pageMark()).toBeUndefined();
        expect(await backsToPreviousPage()).toBe(1);
      });

      it('다른 주소로 덮어쓰면 이어 붙이지 않는다', async () => {
        await openOnPreviousPage();
        const here = window.location.href;
        nextRewrites(`${window.location.pathname}?other=1`);
        expect(historyStep()).toBeUndefined();
        window.history.replaceState({}, '', here);
      });

      it('다른 회차의 기록은 이어 붙이지 않고, 화면을 닫으면 원래 함수로 돌아온다', async () => {
        const original = window.history.replaceState;
        const screen = await openOnPreviousPage();
        expect(window.history.replaceState).not.toBe(original);
        window.history.pushState({ connectionStep: 2, connectionDepth: 1, connectionMount: 'other' }, '');
        nextRewrites();
        expect(historyStep()).toBeUndefined();
        await screen.unmount();
        expect(window.history.replaceState).toBe(original);
      });

      it('닫기 전에 다른 코드가 위에서 감쌌으면 그 함수는 두고, 닫힌 뒤에는 이어 붙이지 않는다', async () => {
        const original = window.history.replaceState;
        const screen = await openOnPreviousPage();
        const inner = window.history.replaceState;
        const outer = function (this: History, ...args: Parameters<History['replaceState']>) {
          return inner.apply(this, args);
        };
        window.history.replaceState = outer;
        await screen.unmount();
        expect(window.history.replaceState).toBe(outer);
        nextRewrites();
        expect(historyStep()).toBeUndefined();
        window.history.replaceState = original;
      });
    });

    it('[이전]은 브라우저 뒤로 가기와 같다 - 기록이 함께 줄어 다시 앞으로 갈 수 있다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await goToLastStep(screen, 'aB3x9Z', '엄마', '아들');

      await back(screen).click();
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
      expect(historyStep()).toBe(2);
      window.history.forward();
      await expect.element(title(screen)).toHaveTextContent('어르신께 나는 누구인가요?');
    });

    it('필요한 값이 없는 단계로는 가지 않는다 - 그 기록을 갈 수 있는 단계로 고친다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await fillId(screen, 'aB3x9Z');
      await next(screen).click();
      await screen.getByRole('radio', { name: '엄마', exact: true }).click();
      await next(screen).click();
      window.history.go(-2);
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
      await userEvent.clear(screen.getByLabelText('어르신의 회원 ID').element() as HTMLInputElement);

      // ID를 지운 채 앞으로 가기 - 2단계 기록이지만 1단계에 머문다
      window.history.forward();
      await expect.poll(historyStep).toBe(1);
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
    });

    it('완료 화면에서 뒤로 가면 보낸 요청의 3단계가 아니라 빈 1단계다', async () => {
      api.requestWardConnection.mockResolvedValue(ok(null));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await goToLastStep(screen, 'aB3x9Z', '엄마', '아들');
      await send(screen).click();
      await expect.element(title(screen)).toHaveTextContent('연결 요청을 보냈어요');
      expect(historyStep()).toBe('done');

      window.history.back();
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
      await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('');
      // 다시 앞으로 가도 완료 화면은 열리지 않는다(이미 끝난 일)
      window.history.forward();
      await expect.poll(historyStep).toBe(1);
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
    });

    it('[회원 ID 바꾸기]는 쌓인 단계만큼 되돌아가 1단계로 간다', async () => {
      api.requestWardConnection.mockRejectedValue(apiError(404, 'USER_NOT_FOUND'));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await goToLastStep(screen);
      await send(screen).click();
      await screen.getByRole('button', { name: '회원 ID 바꾸기' }).click();

      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
      expect(historyStep()).toBe(1);
      // 새 기록을 쌓지 않고 되돌아갔다 - 앞으로 가기로 2단계 기록이 그대로 있다
      window.history.forward();
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
    });
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

  describe('1단계에서 회원 ID 확인 결과를 보인다 (R-2)', () => {
    const check = (screen: Screen) => screen.getByTestId('member-id-check');

    it('직접 입력한 ID도 "이 분이 맞나요?"를 보이고 [다음]이 켜진다', async () => {
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await expect.element(check(screen)).toHaveAttribute('aria-live', 'polite');
      await expect.element(check(screen)).toHaveTextContent('');
      await fillId(screen, 'aB3x9Z');

      await expect.element(check(screen)).toHaveTextContent('이 분이 맞나요? 김*희');
      await expect.element(next(screen)).toBeEnabled();
    });

    it.each([
      [404, 'USER_NOT_FOUND', '이 회원 ID로 가입한 분이 없어요'],
      [409, 'CONNECTION_ALREADY_EXISTS', '이미 연결됐거나 수락을 기다리는 중이에요'],
      [400, 'CANNOT_CONNECT_SELF', '내 회원 ID로는 요청할 수 없어요'],
    ])('%s %s면 그 문구를 보이고 [다음]·Enter로 넘어가지 않는다', async (status, code, expected) => {
      api.previewWardConnection.mockRejectedValue(apiError(status, code));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await fillId(screen, 'aB3x9Z');

      await expect.element(check(screen)).toMatchTextContent(expected);
      await expect.element(next(screen)).toBeDisabled();
      await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveAttribute('aria-invalid', 'true');
      await userEvent.keyboard('{Enter}');
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');

      // 다른 ID로 바꾸면 다시 확인한다
      api.previewWardConnection.mockResolvedValue({ targetId: 'Zz9Zz9', maskedName: '박*수' });
      await fillId(screen, 'Zz9Zz9');
      await expect.element(check(screen)).toHaveTextContent('이 분이 맞나요? 박*수');
      await expect.element(next(screen)).toBeEnabled();
    });

    it('429(확인을 너무 자주 함)는 "연결할 수 없어요"로 안내하지 않고 [다음]을 그대로 둔다', async () => {
      api.previewWardConnection.mockRejectedValue(apiError(429, 'TOO_MANY_REQUESTS', { retryAfterSeconds: 42 }));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await fillId(screen, 'aB3x9Z');

      await expect.element(check(screen)).toHaveTextContent(
        '확인을 너무 여러 번 했어요. 1분 뒤에 다시 확인돼요. 그대로 [다음]을 눌러도 돼요.',
      );
      expect(check(screen).element().textContent).not.toContain('연결할 수 없');
      await expect.element(next(screen)).toBeEnabled();
      await next(screen).click();
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
    });

    it('서버 오류는 확인하지 못했다고만 알리고 [다음]을 그대로 둔다', async () => {
      api.previewWardConnection.mockRejectedValue(apiError(500, 'INTERNAL_SERVER_ERROR'));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await fillId(screen, 'aB3x9Z');

      await expect.element(check(screen)).toHaveTextContent('지금은 이름을 확인하지 못했어요. 그대로 [다음]을 눌러도 돼요.');
      await expect.element(next(screen)).toBeEnabled();
    });

    it('링크(?targetId=)로 들어온 ID도 같게 보이고, 연결할 수 없으면 [다음]을 막는다', async () => {
      nav.query = 'targetId=aB3x9Z';
      api.previewWardConnection.mockRejectedValue(apiError(400, 'INVALID_CONNECTION_ROLE'));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });

      await expect.element(screen.getByLabelText('어르신의 회원 ID')).toHaveValue('aB3x9Z');
      await expect.element(check(screen)).toHaveTextContent('어르신 계정의 회원 ID가 아니에요.');
      await expect.element(next(screen)).toBeDisabled();
    });

    it('확인 중에 [다음]을 누른 뒤 결과가 늦게 "요청할 수 없음"으로 오면 2단계에서 바로 알리고 [다음]·Enter를 막는다 (H-2·I-2)', async () => {
      let reject!: (error: unknown) => void;
      api.previewWardConnection.mockReturnValue(new Promise((_, r) => (reject = r)));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await fillId(screen, 'aB3x9Z');
      await next(screen).click();
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
      expect(screen.getByRole('alert').query()).toBeNull();

      reject(apiError(404, 'USER_NOT_FOUND'));
      await expect.element(screen.getByRole('alert')).toMatchTextContent('이 회원 ID로 가입한 분이 없어요');
      await expect.element(screen.getByRole('button', { name: '회원 ID 바꾸기' })).toBeInTheDocument();

      // 호칭을 골라도 [다음]은 막혀 있고, Enter(폼 제출)로도 3단계에 가지 않는다
      await screen.getByRole('radio', { name: '엄마', exact: true }).click();
      await expect.element(next(screen)).toBeDisabled();
      document.querySelector('form')!.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 50));
      await expect.element(title(screen)).toHaveTextContent('어르신을 뭐라고 부르세요?');
      expect(window.history.state?.connectionStep).toBe(2);
      expect(api.requestWardConnection).not.toHaveBeenCalled();

      // [회원 ID 바꾸기] → 1단계(깊이 0), 다른 ID로 바꾸면 안내가 사라지고 고른 값은 남고 [다음]이 다시 열린다
      api.previewWardConnection.mockResolvedValue({ targetId: 'Zz9Zz9', maskedName: '박*수' });
      await screen.getByRole('button', { name: '회원 ID 바꾸기' }).click();
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
      await expect.poll(() => window.history.state?.connectionDepth).toBe(0);
      await fillId(screen, 'Zz9Zz9');
      await expect.element(check(screen)).toHaveTextContent('이 분이 맞나요? 박*수');
      await next(screen).click();
      expect(screen.getByRole('alert').query()).toBeNull();
      await expect.element(screen.getByRole('radio', { name: '엄마', exact: true })).toBeChecked();
      await expect.element(next(screen)).toBeEnabled();
    });

    it('3단계까지 간 뒤 결과가 늦게 "요청할 수 없음"으로 오면 3단계에서 알리고 보내기를 막는다 (H-2)', async () => {
      let reject!: (error: unknown) => void;
      api.previewWardConnection.mockReturnValue(new Promise((_, r) => (reject = r)));
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });
      await fillId(screen, 'aB3x9Z');
      await next(screen).click();
      await screen.getByRole('radio', { name: '엄마', exact: true }).click();
      await next(screen).click();
      await screen.getByRole('radio', { name: '아들', exact: true }).click();
      await expect.element(send(screen)).toBeEnabled();

      reject(apiError(404, 'USER_NOT_FOUND'));
      await expect.element(screen.getByRole('alert')).toMatchTextContent('이 회원 ID로 가입한 분이 없어요');
      await expect.element(send(screen)).toBeDisabled();
      document.querySelector('form')!.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(api.requestWardConnection).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: '회원 ID 바꾸기' }).click();
      await expect.element(title(screen)).toHaveTextContent('어르신의 회원 ID를 알려 주세요');
      await expect.poll(() => window.history.state?.connectionDepth).toBe(0);
    });

    it('링크로 들어온 맞는 ID는 바로 "이 분이 맞나요?"를 보인다', async () => {
      nav.query = 'targetId=aB3x9Z';
      const screen = await render(<GuardianConnectionRequestForm />, { wrapper });

      await expect.element(check(screen)).toHaveTextContent('이 분이 맞나요? 김*희');
      await expect.element(next(screen)).toBeEnabled();
    });
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
