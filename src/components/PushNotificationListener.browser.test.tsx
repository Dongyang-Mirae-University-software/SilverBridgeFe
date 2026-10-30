// 앱 안 웹푸시 토스트 - 문구 우선순위·종류별 구성·버튼 이동·반응형 위치. 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import PushNotificationListener from './PushNotificationListener';

type ForegroundHandler = (payload: { data?: Record<string, string>; notification?: { title?: string; body?: string } }) => void;

const mocks = vi.hoisted(() => ({
  handler: null as ForegroundHandler | null,
  pathname: '/guardian',
  push: vi.fn(),
  accept: vi.fn(),
  savePending: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));
vi.mock('@/lib/fcm', () => ({
  listenForegroundMessages: (handler: ForegroundHandler) => {
    mocks.handler = handler;
    return () => {};
  },
}));
vi.mock('@/service/api/ward/connection', async importOriginal => ({
  ...(await importOriginal<typeof import('@/service/api/ward/connection')>()),
  acceptWardConnection: mocks.accept,
  refuseWardConnectionRequest: vi.fn(),
}));
vi.mock('@/lib/realtime/pendingConnectionRequests', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/realtime/pendingConnectionRequests')>()),
  removePendingConnectionRequest: vi.fn(),
  savePendingConnectionRequest: mocks.savePending,
}));

function renderListener() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PushNotificationListener />
    </QueryClientProvider>,
  );
}

async function receive(payload: Parameters<ForegroundHandler>[0]) {
  await vi.waitFor(() => expect(mocks.handler).not.toBeNull());
  mocks.handler!(payload);
}

beforeEach(async () => {
  mocks.handler = null;
  mocks.pathname = '/guardian';
  mocks.push.mockReset();
  mocks.accept.mockReset().mockResolvedValue(undefined);
  mocks.savePending.mockReset();
  await page.viewport(1280, 800);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('문구·구성', () => {
  it('data의 제목·본문을 먼저 쓰고 두 줄 본문을 줄바꿈으로 보여준다', async () => {
    const screen = renderListener();
    await receive({
      data: { type: 'MEDICATION_MISSED', title: '복약 확인 요청', body: '첫 문장\n둘째 문장', wardId: 'w1', doseDate: 'd' },
      notification: { title: '옛 제목', body: '옛 본문' },
    });

    await expect.element(screen.getByText('복약 확인 요청')).toBeVisible();
    const body = screen.getByText(/첫 문장/).element();
    expect(body.textContent).toBe('첫 문장\n둘째 문장');
    expect(getComputedStyle(body).whiteSpace).toBe('pre-line');
    await expect.element(screen.getByText('복약', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('방금')).toBeVisible();
  });

  it('복약 미복용은 값이 있을 때만 N번 중 M번 막대를 그린다', async () => {
    const screen = renderListener();
    await receive({ data: { type: 'MEDICATION_MISSED', totalCount: '3', missedCount: '1', wardId: 'w', doseDate: 'a' } });
    await expect.element(screen.getByText('3번 중 2번 체크')).toBeVisible();

    await receive({ data: { type: 'MEDICATION_MISSED', wardId: 'w', doseDate: 'b' } });
    expect(screen.getByText(/번 중/).elements()).toHaveLength(1);
  });

  it('SOS는 긴급(assertive)으로 알리고 두 버튼이 각 화면으로 간다', async () => {
    const screen = renderListener();
    await receive({ data: { type: 'WARD_SOS', sosEventId: '1', title: '긴급 SOS', body: '도움 요청' } });

    const toast = screen.getByRole('alert');
    await expect.element(toast).toHaveAttribute('aria-live', 'assertive');
    await screen.getByRole('button', { name: '가족 연락처' }).click();
    expect(mocks.push).toHaveBeenCalledWith('/guardian/wards');
  });

  it('보호자 이상감지의 실시간 보기는 그 카메라를 연다', async () => {
    const screen = renderListener();
    await receive({ data: { type: 'ANOMALY_DETECTED', anomalyEventId: '9', sessionId: 'ward_x', detectedType: 'FIRE' } });

    await screen.getByRole('button', { name: '실시간 보기' }).click();
    expect(mocks.push).toHaveBeenCalledWith('/guardian/detection?session=ward_x');
  });

  it('피보호자 본인 이상감지에는 영상 버튼이 없다', async () => {
    mocks.pathname = '/ward';
    const screen = renderListener();
    await receive({ data: { type: 'ANOMALY_DETECTED', anomalyEventId: '10', title: '실버브릿지', body: '불이 났어요' } });

    await expect.element(screen.getByText('불이 났어요')).toBeVisible();
    expect(screen.getByRole('button', { name: '실시간 보기' }).elements()).toHaveLength(0);
  });

  it('연결 요청은 기존처럼 대기 요청을 저장하고 수락할 수 있다', async () => {
    mocks.pathname = '/ward';
    const screen = renderListener();
    await receive({ data: { type: 'CONNECTION_REQUEST', connectionId: '42' } });

    expect(mocks.savePending).toHaveBeenCalled();
    await screen.getByRole('button', { name: '수락' }).click();
    expect(mocks.accept).toHaveBeenCalledWith(42);
  });

  it('닫기 버튼에는 어떤 알림인지 이름이 있다', async () => {
    const screen = renderListener();
    await receive({ data: { type: 'INQUIRY_ANSWERED', inquiryId: '3', title: '문의 답변', body: '답변이 왔어요' } });

    await screen.getByRole('button', { name: '문의 답변 알림 닫기' }).click();
    await expect.element(screen.getByText('답변이 왔어요')).not.toBeInTheDocument();
  });
});

describe('반응형 위치', () => {
  it.each([
    [375, 'top'],
    [768, 'bottom'],
    [1280, 'bottom'],
  ])('%ipx 에서 잘리거나 겹치지 않는다', async (width, edge) => {
    await page.viewport(width, 800);
    const screen = renderListener();
    await receive({ data: { type: 'WARD_SOS', sosEventId: '1', title: '긴급 SOS', body: '첫 줄\n둘째 줄' } });
    await receive({ data: { type: 'CONNECTION_ACCEPTED', connectionId: '2', title: '연결 수락', body: '연결되었습니다.' } });

    await vi.waitFor(() => expect(document.querySelectorAll('section')).toHaveLength(2));
    // 들어오는 움직임이 끝난 뒤의 자리를 잰다
    await Promise.all(document.getAnimations().map(animation => animation.finished));
    const [first, second] = [...document.querySelectorAll('section')].map(node => node.getBoundingClientRect());
    for (const rect of [first, second]) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(800);
    }
    expect(first.bottom <= second.top || second.bottom <= first.top).toBe(true);

    const area = document.querySelector('section')!.parentElement!.getBoundingClientRect();
    if (edge === 'top') expect(area.top).toBeLessThan(40);
    else expect(800 - area.bottom).toBeLessThan(40);
    if (width > 520) expect(area.width).toBeLessThanOrEqual(360);
    screen.unmount();
  });
});
