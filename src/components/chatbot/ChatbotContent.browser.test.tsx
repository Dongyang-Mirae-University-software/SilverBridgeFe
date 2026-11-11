// AI 의료 챗봇 화면 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 보호자·피보호자 화면은 일부러 다르게 보인다(2026-10-30): 보호자는 헤더·피보호자 선택·칩, 피보호자는 큰 빠른 질문 버튼.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import ChatbotContent from './ChatbotContent';
import { clearSelectedWardId, setSelectedWardId } from '@/store/selectedWardStore';

const api = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  getChatLogs: vi.fn(),
  role: vi.fn(),
  wards: vi.fn(),
  wardsLoading: vi.fn(),
  wardsFailed: vi.fn(),
  refetchWards: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));

vi.mock('@/service/api/chat', () => ({
  sendChatMessage: api.sendChatMessage,
  getChatLogs: api.getChatLogs,
  getChatErrorMessage: () => '잠시 후 다시 시도해 주세요.',
}));
// 기록 경고 문구는 실제 함수를 쓴다(따로 흉내 내면 실제 함수가 바뀔 때 테스트만 옛 동작을 본다 - 점검 L-4).
vi.mock('@/service/query/user/profile', () => ({
  myProfileQueryOptions: { queryKey: ['test-profile'], queryFn: () => ({ name: '박순자', profileImage: null }) },
}));
vi.mock('@/utils/auth/userProfile', () => ({ getUserProfileData: (response: unknown) => response }));
vi.mock('@/lib/auth/tokenStore', () => ({ getAuthRole: api.role, getAccessTokenSubject: () => 'user-1' }));
vi.mock('@/hooks/useActiveConnections', () => ({
  useGuardianActiveWards: (enabled: boolean) => ({
    activeWards: enabled ? api.wards() : [],
    isLoading: enabled ? api.wardsLoading() : false,
    isError: enabled ? Boolean(api.wardsFailed()) : false,
    refetch: api.refetchWards,
  }),
}));
vi.mock('@/components/connections/WardSelectorTabs', () => ({
  WardSelectorTabs: ({
    wards,
    onSelect,
  }: {
    wards: { wardId: string; wardName: string }[];
    onSelect: (wardId: string) => void;
  }) => (
    <div>
      {wards.map(ward => (
        <button key={ward.wardId} type="button" onClick={() => onSelect(ward.wardId)}>
          {ward.wardName}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));
vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => <span data-testid="avatar" /> }));
vi.mock('./ChatToolCard', () => ({ default: () => null }));
vi.mock('./ChatUiPrompt', () => ({ default: () => null }));

const WARD = {
  partnerUserId: 'ward-1',
  partnerName: '김영희',
  partnerBirthDate: '1950-03-02',
  partnerPhone: '010-0000-0000',
  partnerGender: 'FEMALE',
  relation: '딸',
  partnerProfileImage: null,
};

const WARD_2 = { ...WARD, partnerUserId: 'ward-2', partnerName: '이철수' };

const REPLY = { reply: '정형외과 진료를 권해요.', engine: 'ai', type: 'message' };

function renderChat(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(async () => {
  await page.viewport(1280, 800);
});

beforeEach(() => {
  api.sendChatMessage.mockReset();
  api.getChatLogs.mockReset();
  api.push.mockReset();
  api.wards.mockReturnValue([WARD]);
  api.wardsLoading.mockReturnValue(false);
  api.wardsFailed.mockReturnValue(false);
  api.refetchWards.mockReset();
  sessionStorage.clear();
  clearSelectedWardId();
});

describe('보호자 AI 의료 챗봇', () => {
  beforeEach(() => api.role.mockReturnValue('GUARDIAN'));

  it('헤더·상담 기록·피보호자 선택과 피보호자 이름 인사말을 보여 준다', async () => {
    await renderChat(<ChatbotContent />);

    await expect.element(page.getByRole('heading', { name: 'AI 의료 챗봇' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '상담 기록' })).toBeVisible();
    await expect.element(page.getByRole('region', { name: '상담할 피보호자' })).toBeVisible();
    await expect.element(page.getByText(/김영희의 증상을 말씀해 주시면/)).toBeVisible();
    await expect.element(page.getByPlaceholder('여기에 궁금한 점을 써 주세요')).toBeVisible();
  });

  it('상담 기록은 대화창 단위로 묶고, 누르면 그 대화의 질문·답 전체를 시간순으로 보인다 (2026-11-11)', async () => {
    // AI 목록은 최신순으로 온다
    api.getChatLogs.mockResolvedValue([
      { id: 4, sessionId: 's-2', message: '머리가 아파요', reply: '푹 쉬세요.', createdAt: '2026-11-11T02:00:00Z' },
      { id: 3, sessionId: 's-1', message: '[선택] date: 2026-11-12', reply: '예약했어요.', createdAt: '2026-11-10T00:03:00Z' },
      { id: 2, sessionId: 's-1', message: '언제 가면 좋아요?', reply: '내일 가 보세요.', createdAt: '2026-11-10T00:02:00Z' },
      { id: 1, sessionId: 's-1', message: '무릎이 아파요', reply: '정형외과 진료를 권해요.', createdAt: '2026-11-10T00:01:00Z' },
    ]);
    await renderChat(<ChatbotContent />);
    await page.getByRole('button', { name: '상담 기록' }).click();

    const dialog = page.getByRole('dialog');
    const items = dialog.getByRole('button', { name: /대화 보기/ });
    await expect.element(items.first()).toBeVisible();
    expect(items.elements()).toHaveLength(2);
    expect(items.elements()[0].textContent).toContain('머리가 아파요');
    expect(items.elements()[1].textContent).toContain('무릎이 아파요');
    expect(items.elements()[1].textContent).toContain('질문 3번');

    await items.nth(1).click();
    const detail = dialog.getByLabelText('상담 대화');
    await expect.element(detail.getByText('내일 가 보세요.')).toBeVisible();
    const text = detail.element().textContent ?? '';
    const order = ['무릎이 아파요', '정형외과 진료를 권해요.', '언제 가면 좋아요?', '내일 가 보세요.', '예약했어요.'].map(t => text.indexOf(t));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // 선택지 턴은 값 원문("[선택] date: …")이 아니라 읽기 좋은 날짜로
    expect(text).not.toContain('[선택]');
    expect(text).not.toContain('머리가 아파요');

    await dialog.getByRole('button', { name: /목록으로/ }).click();
    await expect.element(items.first()).toBeVisible();
  });

  it('보호자 상담 기록은 누구의 상담인지 나눠 보인다 - 피보호자·내 상담 칩, 대화마다 대상 표시 (2026-11-11)', async () => {
    api.wards.mockReturnValue([WARD, WARD_2]);
    api.getChatLogs.mockResolvedValue([
      { id: 3, sessionId: 's-3', wardId: null, message: '내 허리가 아파요', reply: 'a', createdAt: '2026-11-11T03:00:00Z' },
      { id: 2, sessionId: 's-2', wardId: 'ward-2', message: '아버지 기침', reply: 'b', createdAt: '2026-11-11T02:00:00Z' },
      { id: 1, sessionId: 's-1', wardId: 'ward-1', message: '어머니 무릎', reply: 'c', createdAt: '2026-11-11T01:00:00Z' },
    ]);
    await renderChat(<ChatbotContent />);
    await page.getByRole('button', { name: '상담 기록' }).click();

    const dialog = page.getByRole('dialog');
    const group = dialog.getByRole('group', { name: '누구의 상담인지 고르기' });
    await expect.element(group).toBeVisible();
    expect(group.getByRole('button').elements().map(el => el.textContent)).toEqual(['전체', '김영희', '이철수', '내 상담']);
    const items = dialog.getByRole('button', { name: /대화 보기/ });
    expect(items.elements()).toHaveLength(3);
    expect(items.elements()[1].textContent).toContain('이철수 님 상담');
    expect(items.elements()[0].textContent).toContain('내 상담');

    await group.getByRole('button', { name: '이철수' }).click();
    await expect.element(group.getByRole('button', { name: '이철수' })).toHaveAttribute('aria-pressed', 'true');
    expect(items.elements()).toHaveLength(1);
    expect(items.elements()[0].textContent).toContain('아버지 기침');
  });

  it('서버가 상담 대상 칸을 주지 않으면(옛 서버) 나누지 않고 한 목록으로 보인다 (2026-11-11)', async () => {
    api.wards.mockReturnValue([WARD, WARD_2]);
    api.getChatLogs.mockResolvedValue([
      { id: 2, sessionId: 's-2', message: '아버지 기침', reply: 'b', createdAt: '2026-11-11T02:00:00Z' },
      { id: 1, sessionId: 's-1', message: '어머니 무릎', reply: 'c', createdAt: '2026-11-11T01:00:00Z' },
    ]);
    await renderChat(<ChatbotContent />);
    await page.getByRole('button', { name: '상담 기록' }).click();
    const dialog = page.getByRole('dialog');
    await expect.element(dialog.getByRole('button', { name: /대화 보기/ }).first()).toBeVisible();
    expect(dialog.getByRole('group').elements()).toHaveLength(0);
    expect(dialog.element().textContent).not.toContain('님 상담');
  });

  it('상담 대화에서도 응급 경고 상자를 보이고, 옛 기록(layout 없음)은 reply 를 그린다 (2026-11-11)', async () => {
    api.getChatLogs.mockResolvedValue([
      {
        id: 1,
        sessionId: 's-1',
        message: '가슴이 아파요',
        reply: '🚨 지금 바로 119에 전화하세요.',
        riskLevel: 'high',
        emergencyWarning: ['🚨 지금 바로 119에 전화하세요.', '⚠️ 혼자 움직이지 마세요.'],
        layout: null,
        createdAt: '2026-11-09T00:00:00Z',
      },
    ]);
    await renderChat(<ChatbotContent />);
    await page.getByRole('button', { name: '상담 기록' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /대화 보기/ }).click();

    const detail = page.getByLabelText('상담 대화');
    await expect.element(detail.getByText(/혼자 움직이지 마세요/)).toBeVisible();
    expect(detail.element().textContent).toContain('가슴이 아파요');
    expect(detail.element().textContent).toContain('119');
  });

  it('메뉴를 오갔다 돌아와도(화면을 다시 열어도) 대화와 sessionId 가 이어진다 (2026-11-11)', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    const first = await renderChat(<ChatbotContent />);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    await first.unmount();

    await renderChat(<ChatbotContent />);
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    await expect.element(page.getByText('무릎이 아파요', { exact: true })).toBeVisible();
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '언제 가면 좋아요?');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));

    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));
    const [a, b] = api.sendChatMessage.mock.calls.map(call => call[0]);
    expect(b.sessionId).toBe(a.sessionId);
    // localStorage 에는 남기지 않는다
    expect(Object.keys(localStorage).some(key => key.startsWith('careai_chat_conv:'))).toBe(false);
  });

  it('[새 대화]는 확인 뒤 저장한 대화를 지우고 새 sessionId 로 시작한다 (2026-11-11)', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const first = await renderChat(<ChatbotContent />);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();

    await page.getByRole('button', { name: '새 대화' }).click();
    expect(confirm).toHaveBeenCalledTimes(1);
    await expect.element(page.getByText('정형외과 진료를 권해요.')).not.toBeInTheDocument();
    expect(Object.keys(sessionStorage).some(key => key.startsWith('careai_chat_conv:'))).toBe(false);

    await first.unmount();
    await renderChat(<ChatbotContent />);
    await expect.element(page.getByText(/김영희의 증상을 말씀해 주시면/)).toBeVisible();
    expect(page.getByText('정형외과 진료를 권해요.').elements()).toHaveLength(0);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '다시 물어요');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));
    const [a, b] = api.sendChatMessage.mock.calls.map(call => call[0]);
    expect(b.sessionId).not.toBe(a.sessionId);
    confirm.mockRestore();
  });

  it('피보호자마다 대화를 따로 이어 간다 - 바꿨다 돌아오면 그 피보호자 대화가 그대로 (2026-11-11)', async () => {
    api.wards.mockReturnValue([WARD, WARD_2]);
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();

    await page.getByRole('button', { name: '이철수' }).click();
    await expect.element(page.getByText(/이철수의 증상을 말씀해 주시면/)).toBeVisible();
    expect(page.getByText('정형외과 진료를 권해요.').elements()).toHaveLength(0);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '머리가 아파요');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));

    await page.getByRole('button', { name: '김영희' }).click();
    await expect.element(page.getByText('무릎이 아파요', { exact: true })).toBeVisible();
    expect(page.getByText('머리가 아파요', { exact: true }).elements()).toHaveLength(0);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '언제 가요?');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(3));
    const [a, b, c] = api.sendChatMessage.mock.calls.map(call => call[0]);
    expect(b.sessionId).not.toBe(a.sessionId);
    expect(c.sessionId).toBe(a.sessionId);
    expect(c.context).toEqual({ role: 'GUARDIAN', wardId: 'ward-1' });
  });

  it('탭 저장소를 쓸 수 없어도(사생활 보호 모드) 지금처럼 상담된다 (2026-11-11)', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      api.sendChatMessage.mockResolvedValue(REPLY);
      await renderChat(<ChatbotContent />);
      await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
      await userEvent.click(page.getByRole('button', { name: '보내기' }));
      await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    } finally {
      set.mockRestore();
      get.mockRestore();
    }
  });

  it('예약 칩으로 화면을 옮겼다 돌아오면 그 말풍선은 남고 "답 없음" 안내는 뜨지 않는다 (2026-11-11)', async () => {
    const first = await renderChat(<ChatbotContent />);
    await page.getByRole('button', { name: '병원 예약하고 싶어요' }).click();
    await vi.waitFor(() => expect(api.push).toHaveBeenCalled());
    await first.unmount();

    await renderChat(<ChatbotContent />);
    await expect.element(page.getByText(/김영희의 증상을 말씀해 주시면/)).toBeVisible();
    await vi.waitFor(() => expect(page.getByText('병원 예약하고 싶어요', { exact: true }).elements().length).toBeGreaterThanOrEqual(2));
    expect(page.getByText(/답을 받기 전에 화면을 옮겨서/).elements()).toHaveLength(0);
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });

  it('답을 받기 전에 화면을 옮겼다 돌아오면 답이 없다고 알린다 (2026-11-11)', async () => {
    api.sendChatMessage.mockReturnValue(new Promise(() => {}));
    const first = await renderChat(<ChatbotContent />);
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await expect.element(page.getByText('무릎이 아파요', { exact: true })).toBeVisible();
    await first.unmount();

    await renderChat(<ChatbotContent />);
    await expect.element(page.getByText(/답을 받기 전에 화면을 옮겨서/)).toBeVisible();
  });

  it('휴대폰 폭(375px)에서도 누르는 칩은 48px 이상이다 (2026-11-09 점검 L-3)', async () => {
    await page.viewport(375, 800);
    await renderChat(<ChatbotContent />);
    const chip = page.getByRole('button', { name: '무릎이 아프다고 하세요' });
    await expect.element(chip).toBeVisible();
    expect(chip.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  });

  it('피보호자 목록을 불러오는 동안에는 칩·입력·보내기를 잠그고 안내한다 - 본인 상담으로 새지 않게(2026-11-03 점검 M-1)', async () => {
    api.wards.mockReturnValue([]);
    api.wardsLoading.mockReturnValue(true);
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await expect.element(page.getByText('피보호자 정보를 불러오는 중이에요')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '무릎이 아프다고 하세요' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: '병원 예약하고 싶어요' })).toBeDisabled();
    await expect.element(page.getByPlaceholder('여기에 궁금한 점을 써 주세요')).toBeDisabled();
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });

  it('피보호자 목록을 불러오지 못하면 잠근 채 다시 불러오기를 보인다 - 본인 상담으로 새지 않게(2026-11-10 전체 점검 F-1)', async () => {
    api.wards.mockReturnValue([]);
    api.wardsFailed.mockReturnValue(true);
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await expect.element(page.getByRole('alert').filter({ hasText: '피보호자 정보를 불러오지 못했어요' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '무릎이 아프다고 하세요' })).toBeDisabled();
    await expect.element(page.getByPlaceholder('여기에 궁금한 점을 써 주세요')).toBeDisabled();
    await userEvent.click(page.getByRole('button', { name: '다시 불러오기' }));
    expect(api.refetchWards).toHaveBeenCalledTimes(1);
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });

  it('피보호자 목록이 없는 보호자(로딩 끝)는 지금처럼 본인 상담으로 보낼 수 있다', async () => {
    api.wards.mockReturnValue([]);
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await expect.element(page.getByText('눌러서 물어보세요')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[0][0].context ?? {}).not.toHaveProperty('wardId');
  });

  it('추천 칩은 펼쳐져 있고 누르면 선택한 피보호자 context로 바로 보낸다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    const request = api.sendChatMessage.mock.calls[0][0];
    expect(request.message).toBe('무릎이 아프다고 하세요');
    expect(request.context).toEqual({ role: 'GUARDIAN', wardId: 'ward-1' });
    expect(request).not.toHaveProperty('history');
  });

  it('예약 칩은 AI를 부르지 않고 내 말풍선을 남긴 뒤 병원 예약 화면으로 이동한다', async () => {
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));

    const bubbles = () =>
      page
        .getByText('병원 예약하고 싶어요', { exact: true })
        .elements()
        .filter(element => !element.closest('button'));
    await vi.waitFor(() => expect(bubbles()).toHaveLength(1));
    await vi.waitFor(() => expect(api.push).toHaveBeenCalledWith('/guardian/hospital'));
    expect(api.push).toHaveBeenCalledTimes(1);
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });

  it('챗봇에서 고른 피보호자는 전역 선택이 되어 예약 화면이 이어받는다(주소창엔 싣지 않음)', async () => {
    api.wards.mockReturnValue([WARD, WARD_2]);
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '이철수' }));
    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));

    await vi.waitFor(() => expect(api.push).toHaveBeenCalledWith('/guardian/hospital'));
    expect(sessionStorage.getItem('careai_selected_ward_id')).toBe('ward-2');
  });

  it('다른 화면에서 고른 피보호자로 시작한다', async () => {
    api.wards.mockReturnValue([WARD, WARD_2]);
    setSelectedWardId('ward-2');
    await renderChat(<ChatbotContent />);

    await expect.element(page.getByText(/이철수의 증상을 말씀해 주시면/)).toBeVisible();
  });

  it('이동 전에 화면을 벗어나면(타이머 취소) 예약 화면으로 가지 않는다', async () => {
    const screen = await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
    await screen.unmount();

    await new Promise(resolve => setTimeout(resolve, 800));
    expect(api.push).not.toHaveBeenCalled();
  });

  it('저장소를 쓸 수 없어도 예약 화면으로는 이동한다', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });
    try {
      await renderChat(<ChatbotContent />);
      await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
      await vi.waitFor(() => expect(api.push).toHaveBeenCalledWith('/guardian/hospital'));
    } finally {
      spy.mockRestore();
    }
  });

  it('답을 기다리는 중에는 예약 칩도 누를 수 없다', async () => {
    api.sendChatMessage.mockReturnValue(new Promise(() => {}));
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));

    await expect.element(page.getByRole('button', { name: '병원 예약하고 싶어요' })).toBeDisabled();
    expect(api.push).not.toHaveBeenCalled();
  });

  it('직접 쓴 "병원 예약해줘"는 지금처럼 AI로 보내고 이동하지 않는다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '병원 예약해줘');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[0][0].message).toBe('병원 예약해줘');
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(api.push).not.toHaveBeenCalled();
  });

  it('같은 대화창에서는 sessionId를 유지한다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '언제 가면 좋아요?');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));

    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));
    const [first, second] = api.sendChatMessage.mock.calls.map(call => call[0]);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second).not.toHaveProperty('history');
  });

  it('입력창에서 보낸 뒤에는 입력창으로 포커스를 되돌린다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    await renderChat(<ChatbotContent />);

    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    await vi.waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'));
  });

  it('휴대폰 키보드가 올라온 입력 중에는 칩 줄을 숨겨 대화를 가리지 않는다', async () => {
    await page.viewport(375, 700);
    await renderChat(<ChatbotContent />);

    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    await userEvent.click(page.getByRole('textbox', { name: '궁금한 점 입력' }));
    // 포커스만으로는 숨기지 않는다(실제 키보드가 없는 PC·태블릿)
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();

    await page.viewport(375, 380); // 화면 키보드가 올라온 높이
    await expect.element(page.getByRole('region', { name: '추천 질문' })).not.toBeInTheDocument();
  });
});

describe('휴대폰 폭 375px - 상담 기록·새 대화 (2026-11-11)', () => {
  it('보호자 상담 기록 목록·대화 보기가 화면 밖으로 넘치지 않는다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    await page.viewport(375, 800);
    api.getChatLogs.mockResolvedValue([
      { id: 2, sessionId: 's-1', message: '아주 긴 질문입니다 '.repeat(12), reply: '긴 답입니다. '.repeat(20), createdAt: '2026-11-11T00:02:00Z' },
      { id: 1, sessionId: 's-1', message: '무릎이 아파요', reply: '정형외과 진료를 권해요.', createdAt: '2026-11-11T00:01:00Z' },
    ]);
    await renderChat(<ChatbotContent />);
    await page.getByRole('button', { name: '상담 기록' }).click();
    const item = page.getByRole('dialog').getByRole('button', { name: /대화 보기/ });
    await expect.element(item).toBeVisible();
    expect(item.element().getBoundingClientRect().right).toBeLessThanOrEqual(375);
    await item.click();
    const detail = page.getByLabelText('상담 대화');
    await expect.element(detail.getByText('정형외과 진료를 권해요.')).toBeVisible();
    expect(detail.element().scrollWidth).toBeLessThanOrEqual(detail.element().clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
  });

  it('피보호자 [새 대화] 버튼은 제목 옆에 44px 이상으로 보인다', async () => {
    api.role.mockReturnValue('WARD');
    await page.viewport(375, 800);
    await renderChat(<ChatbotContent variant="ward" />);
    for (const name of ['새 대화', '상담 기록']) {
      const button = page.getByRole('button', { name });
      await expect.element(button).toBeVisible();
      const rect = button.element().getBoundingClientRect();
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.right).toBeLessThanOrEqual(375);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
  });

  it('피보호자도 [상담 기록]에서 지난 대화를 열어 볼 수 있다 (2026-11-11)', async () => {
    api.role.mockReturnValue('WARD');
    api.getChatLogs.mockResolvedValue([
      { id: 2, sessionId: 's-1', wardId: null, message: '언제 가요?', reply: '내일 가 보세요.', createdAt: '2026-11-11T00:02:00Z' },
      { id: 1, sessionId: 's-1', wardId: null, message: '무릎이 아파요', reply: '정형외과 진료를 권해요.', createdAt: '2026-11-11T00:01:00Z' },
    ]);
    await renderChat(<ChatbotContent variant="ward" />);
    await page.getByRole('button', { name: '상담 기록' }).click();
    const dialog = page.getByRole('dialog');
    // 피보호자는 본인 기록뿐이라 나누지 않는다
    expect(dialog.getByRole('group').elements()).toHaveLength(0);
    await dialog.getByRole('button', { name: /대화 보기/ }).click();
    await expect.element(dialog.getByLabelText('상담 대화').getByText('내일 가 보세요.')).toBeVisible();
    expect(api.getChatLogs).toHaveBeenCalledTimes(1);
  });
});

describe('피보호자 AI 의료 챗봇', () => {
  beforeEach(() => api.role.mockReturnValue('WARD'));

  it('보호자용 헤더·상담 기록·피보호자 선택 없이 큰 빠른 질문 4개를 보여 준다', async () => {
    await renderChat(<ChatbotContent variant="ward" />);

    await expect.element(page.getByText(/안녕하세요, 박순자 님/)).toBeVisible();
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    for (const prompt of ['머리가 아파요', '배가 아파요', '무릎이 아파요', '어지러워요']) {
      await expect.element(page.getByRole('button', { name: prompt })).toBeVisible();
    }
    // [상담 기록]은 피보호자도 제목 옆에 있다(2026-11-11) - 보호자용 헤더·피보호자 선택은 없다
    expect(page.getByRole('region', { name: '상담할 피보호자' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: '병원 예약하고 싶어요' }).elements()).toHaveLength(0);
    await expect.element(page.getByPlaceholder('직접 쓰기')).toBeVisible();
  });

  it('빠른 질문은 본인 상담으로 보내고 피보호자 정보를 싣지 않는다', async () => {
    api.sendChatMessage.mockResolvedValue({ reply: '물을 한 잔 드시고 쉬어 보세요.', engine: 'ai', type: 'message' });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));

    await expect.element(page.getByText('물을 한 잔 드시고 쉬어 보세요.')).toBeVisible();
    const request = api.sendChatMessage.mock.calls[0][0];
    expect(request.message).toBe('머리가 아파요');
    expect(request.context).toEqual({ role: 'WARD' });
    expect(request).not.toHaveProperty('history');
    // 빠른 질문 뒤 입력창으로 포커스를 옮기면 휴대폰 키보드가 올라와 화면을 가린다
    expect(document.activeElement?.tagName).not.toBe('TEXTAREA');
  });

  it('휴대폰 키보드가 올라오면 빠른 질문 칸을 숨기고, 키보드를 내리면 포커스가 남아도 다시 보여 준다', async () => {
    await page.viewport(375, 700);
    await renderChat(<ChatbotContent variant="ward" />);

    await expect.element(page.getByRole('button', { name: '머리가 아파요' })).toBeVisible();
    await userEvent.click(page.getByRole('textbox', { name: '궁금한 점 입력' }));
    await page.viewport(375, 380); // 화면 키보드가 올라온 높이
    // display: none이 되면 접근성 트리에서 빠진다
    await expect.element(page.getByRole('region', { name: '추천 질문' })).not.toBeInTheDocument();

    // 안드로이드는 키보드를 내려도 입력창 포커스가 남는다(2026-10-30 실기기 보고)
    await page.viewport(375, 700);
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    await expect.element(page.getByRole('button', { name: '머리가 아파요' })).toBeVisible();
  });

  it('보내기에 실패하면 안내하고 다시 보낼 수 있다', async () => {
    api.sendChatMessage.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      reply: '다시 연결됐어요.',
      engine: 'ai',
      type: 'message',
    });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('잠시 후 다시 시도해 주세요.')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('다시 연결됐어요.')).toBeVisible();
    expect(api.sendChatMessage).toHaveBeenCalledTimes(2);
  });
});

describe('이어서 물어볼 질문(suggestedQuestions)', () => {
  it('보호자: 답의 질문이 예약 칩 뒤에 나오고, 누르면 그대로 보내며, 질문이 없는 답 뒤에는 고정 문장으로 돌아간다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.sendChatMessage
      .mockResolvedValueOnce({
        ...REPLY,
        suggestedQuestions: ['집에서 쉬면 될까요?', '언제 병원에 가요?', '병원 예약하고 싶어요'],
      })
      .mockResolvedValueOnce({ ...REPLY, reply: '내일 오전이 좋아요.', suggestedQuestions: [] });
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByRole('button', { name: '언제 병원에 가요?' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '집에서 쉬면 될까요?' })).toBeVisible();
    expect(page.getByRole('button', { name: '병원 예약하고 싶어요' }).elements()).toHaveLength(1); // 예약 칩은 한 번만
    expect(page.getByRole('button', { name: '무릎이 아프다고 하세요' }).elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: '언제 병원에 가요?' }));
    await expect.element(page.getByText('내일 오전이 좋아요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[1][0].message).toBe('언제 병원에 가요?');
    await expect.element(page.getByRole('button', { name: '혈압약을 같이 먹어도 되나요?' })).toBeVisible();
    expect(page.getByRole('button', { name: '무릎이 아프다고 하세요' }).elements()).toHaveLength(0); // 이미 보낸 문장
  });

  it('피보호자: 답의 질문이 있으면 그것만 놓고 상관없는 기본 문장으로 채우지 않는다(2026-11-02)', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({
      reply: '물을 한 잔 드시고 쉬어 보세요.',
      engine: 'ai',
      type: 'message',
      suggestedQuestions: ['병원에 가야 할까요?'],
    });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await expect.element(page.getByRole('button', { name: '병원에 가야 할까요?' })).toBeVisible();
    const grid = page.getByRole('region', { name: '추천 질문' }).element();
    expect([...grid.querySelectorAll('button')].map(button => button.textContent)).toEqual(['병원에 가야 할까요?']);
    await expect.element(page.getByText('눌러서 물어보세요')).toBeVisible();
  });

  it('형식이 다른 값(문자열 아님·빈 문자열)은 무시하고 고정 문장을 쓴다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({
      reply: '쉬어 보세요.',
      engine: 'ai',
      type: 'message',
      suggestedQuestions: [3, '  ', null],
    });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('쉬어 보세요.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '어지러워요' })).toBeVisible();
  });
});

describe('되묻기 답 칩(suggestedKind="answer")', () => {
  const HEAD_CHIPS = ['오늘부터 아파요', '며칠째 계속 아파요', '점점 심해져요', '열도 나요'];
  const FOLLOWUP = { ...REPLY, reply: '언제부터 그러셨나요?', suggestedQuestions: HEAD_CHIPS, suggestedKind: 'answer' };

  function panelButtons() {
    const panel = page.getByRole('region', { name: '추천 질문' }).element();
    return [...panel.querySelectorAll('button')].map(button => button.textContent);
  }

  it('피보호자: 되묻기 턴에는 답 칩 4개만, 제목은 "눌러서 답해 보세요" - 칩을 누르면 그대로 보내고 상담 답 뒤에는 기본 칩으로 돌아간다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage
      .mockResolvedValueOnce(FOLLOWUP)
      .mockResolvedValueOnce({ ...REPLY, reply: '신경과 진료를 권해요.', suggestedQuestions: [] });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await expect.element(page.getByText('눌러서 답해 보세요')).toBeVisible();
    expect(panelButtons()).toEqual(HEAD_CHIPS); // 상관없는 증상(배·무릎·어지러워요)을 섞지 않는다

    await userEvent.click(page.getByRole('button', { name: '오늘부터 아파요' }));
    await expect.element(page.getByText('신경과 진료를 권해요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[1][0].message).toBe('오늘부터 아파요');
    await expect.element(page.getByText('눌러서 물어보세요')).toBeVisible();
    expect(panelButtons()).toEqual(['배가 아파요', '무릎이 아파요', '어지러워요']); // 보낸 기본 문장은 뺀다
  });

  it('피보호자: 이미 눌러 보낸 답 칩도 다음 되묻기 턴에는 다시 보인다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue(FOLLOWUP);
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await userEvent.click(page.getByRole('button', { name: '오늘부터 아파요' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(panelButtons()).toEqual(HEAD_CHIPS));
  });

  it('피보호자: 칩이 없는 답(응급 등) 뒤에는 기본 칩과 원래 제목', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ ...REPLY, reply: '바로 119에 연락하세요.', riskLevel: 'high', suggestedQuestions: [] });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('바로 119에 연락하세요.')).toBeVisible();
    await expect.element(page.getByText('눌러서 물어보세요')).toBeVisible();
    expect(panelButtons()).toEqual(['머리가 아파요', '무릎이 아파요', '어지러워요']);
  });

  it('모르는 칩 종류·칸 없음(옛 AI)은 이어서 물어볼 질문으로 본다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage
      .mockResolvedValueOnce({ ...FOLLOWUP, suggestedKind: 'ANSWER' })
      .mockResolvedValueOnce({ ...FOLLOWUP, reply: '두 번째 답', suggestedKind: undefined });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await expect.element(page.getByText('언제부터 그러셨나요?')).toBeVisible();
    await expect.element(page.getByText('눌러서 물어보세요')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: '열도 나요' }));
    await expect.element(page.getByText('두 번째 답')).toBeVisible();
    await expect.element(page.getByText('눌러서 물어보세요')).toBeVisible();
    expect(panelButtons()).not.toContain('열도 나요'); // 이어서 물어볼 질문은 보낸 문장을 뺀다
  });

  it('보호자: 예약 칩은 맨 앞 그대로, 그 뒤에 답 칩 4개와 "눌러서 답해 보세요"', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.sendChatMessage.mockResolvedValue({
      ...FOLLOWUP,
      suggestedQuestions: ['오늘부터 아프시대요', '며칠째 계속 아프시대요', '점점 심해지신대요', '열도 나신대요'],
    });
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('눌러서 답해 보세요')).toBeVisible();
    expect(panelButtons()).toEqual([
      '병원 예약하고 싶어요',
      '오늘부터 아프시대요',
      '며칠째 계속 아프시대요',
      '점점 심해지신대요',
      '열도 나신대요',
    ]);
  });
});

describe('이미 보낸 질문은 빠른 질문에서 뺀다', () => {
  function quickButtons() {
    const panel = page.getByRole('region', { name: '추천 질문' }).element();
    return [...panel.querySelectorAll('button')].map(button => button.textContent);
  }

  it('보호자: 누른 고정 문장은 질문 없는 답 뒤에도 다시 나오지 않고, 예약 칩은 눌러도 남는다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.sendChatMessage.mockResolvedValue({ ...REPLY, suggestedQuestions: [] });
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(quickButtons()).toEqual(['병원 예약하고 싶어요', '혈압약을 같이 먹어도 되나요?', '다음 병원 예약 알려줘']),
    );

    await userEvent.click(page.getByRole('button', { name: '혈압약을 같이 먹어도 되나요?' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));
    await userEvent.click(page.getByRole('button', { name: '다음 병원 예약 알려줘' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(quickButtons()).toEqual(['병원 예약하고 싶어요']));

    // 예약 칩은 AI로 보내지 않고 보낸 문장 기억에도 넣지 않으므로 그대로 남는다.
    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
    await vi.waitFor(() => expect(api.push).toHaveBeenCalledWith('/guardian/hospital'));
    expect(api.sendChatMessage).toHaveBeenCalledTimes(3);
    await vi.waitFor(() => expect(quickButtons()).toEqual(['병원 예약하고 싶어요']));
  });

  it('보호자: 누른 추천 질문은 다음 답에 같은 문장이 와도 보이지 않는다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.sendChatMessage
      .mockResolvedValueOnce({ ...REPLY, suggestedQuestions: ['집에서 쉬면 될까요?', '언제 병원에 가요?'] })
      .mockResolvedValueOnce({
        ...REPLY,
        reply: '내일 오전이 좋아요.',
        suggestedQuestions: ['언제 병원에 가요?', '약은 언제 먹어요?'],
      });
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await userEvent.click(page.getByRole('button', { name: '언제 병원에 가요?' }));
    await expect.element(page.getByText('내일 오전이 좋아요.')).toBeVisible();
    expect(quickButtons()).toEqual(['병원 예약하고 싶어요', '약은 언제 먹어요?']);
  });

  it('입력창에 직접 쓴 같은 문장(앞뒤 공백 무시)도 뺀다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    await renderChat(<ChatbotContent variant="ward" />);

    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '  어지러워요 ');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await expect.element(page.getByText('쉬어 보세요.')).toBeVisible();
    expect(quickButtons()).toEqual(['머리가 아파요', '배가 아파요', '무릎이 아파요']);
  });

  it('피보호자: 다 쓰면 칸이 줄고, 남은 문장이 없으면 입력창 안내를 보여 준다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    await renderChat(<ChatbotContent variant="ward" />);

    for (const [index, text] of ['머리가 아파요', '배가 아파요', '무릎이 아파요', '어지러워요'].entries()) {
      await userEvent.click(page.getByRole('button', { name: text }));
      await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(index + 1));
      await vi.waitFor(() => expect(quickButtons()).toHaveLength(3 - index));
    }
    await expect.element(page.getByText('궁금한 점을 입력창에 적어 주세요')).toBeVisible();
  });

  it('피보호자 휴대폰: 버튼이 3개·1개 남으면 마지막 버튼을 두 칸 폭으로 놓는다(넓은 화면은 그대로)', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    await page.viewport(375, 800);
    await renderChat(<ChatbotContent variant="ward" />);

    const lastButtonSpan = () => {
      const buttons = page.getByRole('region', { name: '추천 질문' }).element().querySelectorAll('button');
      const style = getComputedStyle(buttons[buttons.length - 1]);
      return `${style.gridColumnStart} / ${style.gridColumnEnd}`;
    };

    await vi.waitFor(() => expect(quickButtons()).toHaveLength(4));
    expect(lastButtonSpan()).toBe('auto / auto');

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(3));
    expect(lastButtonSpan()).toBe('1 / -1');

    await page.viewport(1280, 800);
    await vi.waitFor(() => expect(lastButtonSpan()).toBe('auto / auto'));
    await page.viewport(375, 800);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(2));
    expect(lastButtonSpan()).toBe('auto / auto');

    await userEvent.click(page.getByRole('button', { name: '무릎이 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(1));
    expect(lastButtonSpan()).toBe('1 / -1');
  });

  it('글자 가장 크게(28px, 1.647배)여도 태블릿 2×2에서 마지막 버튼이 두 칸 폭이고 가로로 넘치지 않는다(점검 L-2)', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    await page.viewport(768, 1024);
    await renderChat(
      <div style={{ '--ward-font-scale': '1.647' } as React.CSSProperties}>
        <ChatbotContent variant="ward" />
      </div>,
    );

    await vi.waitFor(() => expect(quickButtons()).toHaveLength(4));
    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(3));

    const region = page.getByRole('region', { name: '추천 질문' }).element() as HTMLElement;
    const buttons = [...region.querySelectorAll('button')];
    const last = buttons[buttons.length - 1];
    const grid = last.parentElement as HTMLElement;
    expect(getComputedStyle(last).gridColumnStart).toBe('1');
    expect(Math.round(last.getBoundingClientRect().width)).toBe(Math.round(grid.getBoundingClientRect().width));
    expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
    for (const button of buttons) expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  });

  it('피보호자 태블릿(761~1024px)도 2×2라 버튼이 3개·1개면 마지막 버튼을 두 칸 폭으로 놓는다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    await page.viewport(768, 1024);
    await renderChat(<ChatbotContent variant="ward" />);

    const lastButtonSpan = () => {
      const buttons = page.getByRole('region', { name: '추천 질문' }).element().querySelectorAll('button');
      const style = getComputedStyle(buttons[buttons.length - 1]);
      return `${style.gridColumnStart} / ${style.gridColumnEnd}`;
    };

    await vi.waitFor(() => expect(quickButtons()).toHaveLength(4));
    expect(lastButtonSpan()).toBe('auto / auto');

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(3));
    expect(lastButtonSpan()).toBe('1 / -1');

    await page.viewport(1024, 768);
    await vi.waitFor(() => expect(lastButtonSpan()).toBe('1 / -1'));
    await page.viewport(1025, 768);
    await vi.waitFor(() => expect(lastButtonSpan()).toBe('auto / auto'));
    await page.viewport(768, 1024);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(2));
    expect(lastButtonSpan()).toBe('auto / auto');
    await userEvent.click(page.getByRole('button', { name: '무릎이 아파요' }));
    await vi.waitFor(() => expect(quickButtons()).toHaveLength(1));
    expect(lastButtonSpan()).toBe('1 / -1');
  });

  it('보내기에 실패한 문장은 버튼에 남는다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.sendChatMessage.mockRejectedValueOnce(new Error('network'));
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('잠시 후 다시 시도해 주세요.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '무릎이 아프다고 하세요' })).toBeVisible();
  });

  it('피보호자를 바꾸면 새 대화라 보낸 문장이 다시 보인다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.wards.mockReturnValue([WARD, WARD_2]);
    api.sendChatMessage.mockResolvedValue({ ...REPLY, suggestedQuestions: [] });
    await renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    expect(page.getByRole('button', { name: '무릎이 아프다고 하세요' }).elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: '이철수' }));
    await expect.element(page.getByText(/이철수의 증상을 말씀해 주시면/)).toBeVisible();
    await expect.element(page.getByRole('button', { name: '무릎이 아프다고 하세요' })).toBeVisible();
  });
});
