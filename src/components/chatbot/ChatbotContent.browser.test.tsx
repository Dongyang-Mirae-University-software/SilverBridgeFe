// AI 의료 챗봇 화면 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 보호자·피보호자 화면은 일부러 다르게 보인다(2026-10-30): 보호자는 헤더·피보호자 선택·칩, 피보호자는 큰 빠른 질문 버튼.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import ChatbotContent from './ChatbotContent';

const api = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  getChatLogs: vi.fn(),
  role: vi.fn(),
  wards: vi.fn(),
}));

vi.mock('@/service/api/chat', () => ({
  sendChatMessage: api.sendChatMessage,
  getChatLogs: api.getChatLogs,
  getChatErrorMessage: () => '잠시 후 다시 시도해 주세요.',
}));
vi.mock('@/service/api/chatPolicy', () => ({ getHistoryWarning: () => null }));
vi.mock('@/service/query/user/profile', () => ({
  myProfileQueryOptions: { queryKey: ['test-profile'], queryFn: () => ({ name: '박순자', profileImage: null }) },
}));
vi.mock('@/utils/auth/userProfile', () => ({ getUserProfileData: (response: unknown) => response }));
vi.mock('@/lib/auth/tokenStore', () => ({ getAuthRole: api.role }));
vi.mock('@/hooks/useActiveConnections', () => ({
  useGuardianActiveWards: (enabled: boolean) => ({ activeWards: enabled ? api.wards() : [] }),
}));
vi.mock('@/components/connections/WardSelectorTabs', () => ({
  WardSelectorTabs: ({ wards }: { wards: { wardId: string; wardName: string }[] }) => (
    <div>{wards.map(ward => <span key={ward.wardId}>{ward.wardName}</span>)}</div>
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
  api.wards.mockReturnValue([WARD]);
});

describe('보호자 AI 의료 챗봇', () => {
  beforeEach(() => api.role.mockReturnValue('GUARDIAN'));

  it('헤더·상담 기록·피보호자 선택과 피보호자 이름 인사말을 보여 준다', async () => {
    renderChat(<ChatbotContent />);

    await expect.element(page.getByRole('heading', { name: 'AI 의료 챗봇' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '상담 기록' })).toBeVisible();
    await expect.element(page.getByRole('region', { name: '상담할 피보호자' })).toBeVisible();
    await expect.element(page.getByText(/김영희의 증상을 말씀해 주시면/)).toBeVisible();
    await expect.element(page.getByPlaceholder('여기에 궁금한 점을 써 주세요')).toBeVisible();
  });

  it('추천 칩은 펼쳐져 있고 누르면 선택한 피보호자 context로 바로 보낸다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    const request = api.sendChatMessage.mock.calls[0][0];
    expect(request.message).toBe('병원 예약하고 싶어요');
    expect(request.context).toMatchObject({ role: 'GUARDIAN', wardId: 'ward-1', patientId: 'ward-1' });
    expect(request).not.toHaveProperty('history');
  });

  it('같은 대화창에서는 sessionId를 유지한다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    renderChat(<ChatbotContent />);

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
    renderChat(<ChatbotContent />);

    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '무릎이 아파요');
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    await vi.waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'));
  });

  it('휴대폰에서 입력 중에는 칩 줄을 숨겨 대화를 가리지 않는다', async () => {
    await page.viewport(375, 700);
    renderChat(<ChatbotContent />);

    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    await userEvent.click(page.getByRole('textbox', { name: '궁금한 점 입력' }));
    await expect.element(page.getByRole('region', { name: '추천 질문' })).not.toBeInTheDocument();
  });
});

describe('피보호자 AI 의료 챗봇', () => {
  beforeEach(() => api.role.mockReturnValue('WARD'));

  it('보호자용 헤더·상담 기록·피보호자 선택 없이 큰 빠른 질문 4개를 보여 준다', async () => {
    renderChat(<ChatbotContent variant="ward" />);

    await expect.element(page.getByText(/안녕하세요, 박순자 님/)).toBeVisible();
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    for (const prompt of ['머리가 아파요', '배가 아파요', '무릎이 아파요', '어지러워요']) {
      await expect.element(page.getByRole('button', { name: prompt })).toBeVisible();
    }
    expect(page.getByRole('button', { name: '상담 기록' }).elements()).toHaveLength(0);
    expect(page.getByRole('region', { name: '상담할 피보호자' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: '병원 예약하고 싶어요' }).elements()).toHaveLength(0);
    await expect.element(page.getByPlaceholder('직접 써서 물어보기')).toBeVisible();
  });

  it('빠른 질문은 본인 상담으로 보내고 피보호자 정보를 싣지 않는다', async () => {
    api.sendChatMessage.mockResolvedValue({ reply: '물을 한 잔 드시고 쉬어 보세요.', engine: 'ai', type: 'message' });
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));

    await expect.element(page.getByText('물을 한 잔 드시고 쉬어 보세요.')).toBeVisible();
    const request = api.sendChatMessage.mock.calls[0][0];
    expect(request.message).toBe('머리가 아파요');
    expect(request.context).toEqual({ role: 'WARD' });
    expect(request).not.toHaveProperty('history');
    // 빠른 질문 뒤 입력창으로 포커스를 옮기면 휴대폰 키보드가 올라와 화면을 가린다
    expect(document.activeElement?.tagName).not.toBe('TEXTAREA');
  });

  it('휴대폰에서 입력 중에는 빠른 질문 칸을 숨기고, 입력을 마치면 다시 보여 준다', async () => {
    await page.viewport(375, 700);
    renderChat(<ChatbotContent variant="ward" />);

    await expect.element(page.getByRole('button', { name: '머리가 아파요' })).toBeVisible();
    await userEvent.click(page.getByRole('textbox', { name: '궁금한 점 입력' }));
    // display: none이 되면 접근성 트리에서 빠진다
    await expect.element(page.getByRole('region', { name: '추천 질문' })).not.toBeInTheDocument();

    (document.activeElement as HTMLElement | null)?.blur();
    await expect.element(page.getByRole('button', { name: '머리가 아파요' })).toBeVisible();
  });

  it('보내기에 실패하면 안내하고 다시 보낼 수 있다', async () => {
    api.sendChatMessage.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      reply: '다시 연결됐어요.',
      engine: 'ai',
      type: 'message',
    });
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('잠시 후 다시 시도해 주세요.')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('다시 연결됐어요.')).toBeVisible();
    expect(api.sendChatMessage).toHaveBeenCalledTimes(2);
  });
});
