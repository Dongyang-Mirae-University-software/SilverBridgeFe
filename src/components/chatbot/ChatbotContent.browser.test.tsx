// AI 의료 챗봇 화면 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 보호자·피보호자 화면은 일부러 다르게 보인다(2026-10-30): 보호자는 헤더·피보호자 선택·칩, 피보호자는 큰 빠른 질문 버튼.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import ChatbotContent from './ChatbotContent';
import { RESERVATION_WARD_STORAGE_KEY } from './reservationWardHandoff';

const api = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  getChatLogs: vi.fn(),
  role: vi.fn(),
  wards: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));

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
  sessionStorage.clear();
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

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    const request = api.sendChatMessage.mock.calls[0][0];
    expect(request.message).toBe('무릎이 아프다고 하세요');
    expect(request.context).toMatchObject({ role: 'GUARDIAN', wardId: 'ward-1', patientId: 'ward-1' });
    expect(request).not.toHaveProperty('history');
  });

  it('예약 칩은 AI를 부르지 않고 내 말풍선을 남긴 뒤 병원 예약 화면으로 이동한다', async () => {
    renderChat(<ChatbotContent />);

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

  it('예약 칩은 고른 피보호자 ID만 sessionStorage에 담아 예약 화면으로 넘긴다(주소창·이름·문장은 싣지 않음)', async () => {
    api.wards.mockReturnValue([WARD, WARD_2]);
    renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '이철수' }));
    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));

    await vi.waitFor(() => expect(api.push).toHaveBeenCalledWith('/guardian/hospital'));
    expect(sessionStorage.getItem(RESERVATION_WARD_STORAGE_KEY)).toBe('ward-2');
    expect(sessionStorage.length).toBe(1);
  });

  it('이동 전에 화면을 벗어나면(타이머 취소) 저장소에 남기지 않는다', async () => {
    const screen = renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
    screen.unmount();

    await new Promise(resolve => setTimeout(resolve, 800));
    expect(api.push).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RESERVATION_WARD_STORAGE_KEY)).toBeNull();
  });

  it('저장소를 쓸 수 없어도 예약 화면으로는 이동한다', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });
    try {
      renderChat(<ChatbotContent />);
      await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
      await vi.waitFor(() => expect(api.push).toHaveBeenCalledWith('/guardian/hospital'));
    } finally {
      spy.mockRestore();
    }
  });

  it('답을 기다리는 중에는 예약 칩도 누를 수 없다', async () => {
    api.sendChatMessage.mockReturnValue(new Promise(() => {}));
    renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));

    await expect.element(page.getByRole('button', { name: '병원 예약하고 싶어요' })).toBeDisabled();
    expect(api.push).not.toHaveBeenCalled();
  });

  it('직접 쓴 "병원 예약해줘"는 지금처럼 AI로 보내고 이동하지 않는다', async () => {
    api.sendChatMessage.mockResolvedValue(REPLY);
    renderChat(<ChatbotContent />);

    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '병원 예약해줘');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[0][0].message).toBe('병원 예약해줘');
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(api.push).not.toHaveBeenCalled();
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

  it('휴대폰 키보드가 올라온 입력 중에는 칩 줄을 숨겨 대화를 가리지 않는다', async () => {
    await page.viewport(375, 700);
    renderChat(<ChatbotContent />);

    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    await userEvent.click(page.getByRole('textbox', { name: '궁금한 점 입력' }));
    // 포커스만으로는 숨기지 않는다(실제 키보드가 없는 PC·태블릿)
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();

    await page.viewport(375, 380); // 화면 키보드가 올라온 높이
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
    await expect.element(page.getByPlaceholder('직접 쓰기')).toBeVisible();
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

  it('휴대폰 키보드가 올라오면 빠른 질문 칸을 숨기고, 키보드를 내리면 포커스가 남아도 다시 보여 준다', async () => {
    await page.viewport(375, 700);
    renderChat(<ChatbotContent variant="ward" />);

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
    renderChat(<ChatbotContent variant="ward" />);

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
      .mockResolvedValueOnce({ ...REPLY, suggestedQuestions: ['집에서 쉬면 될까요?', '언제 병원에 가요?', '병원 예약하고 싶어요'] })
      .mockResolvedValueOnce({ ...REPLY, reply: '내일 오전이 좋아요.', suggestedQuestions: [] });
    renderChat(<ChatbotContent />);

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

  it('피보호자: 답의 질문을 먼저 놓고 남는 칸은 보내지 않은 기본 문장으로 채운다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({
      reply: '물을 한 잔 드시고 쉬어 보세요.',
      engine: 'ai',
      type: 'message',
      suggestedQuestions: ['병원에 가야 할까요?'],
    });
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await expect.element(page.getByRole('button', { name: '병원에 가야 할까요?' })).toBeVisible();
    const grid = page.getByRole('region', { name: '추천 질문' }).element();
    expect([...grid.querySelectorAll('button')].map(button => button.textContent)).toEqual([
      '병원에 가야 할까요?',
      '배가 아파요',
      '무릎이 아파요',
      '어지러워요',
    ]);
  });

  it('형식이 다른 값(문자열 아님·빈 문자열)은 무시하고 고정 문장을 쓴다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message', suggestedQuestions: [3, '  ', null] });
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '배가 아파요' }));
    await expect.element(page.getByText('쉬어 보세요.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '어지러워요' })).toBeVisible();
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
    renderChat(<ChatbotContent />);

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
      .mockResolvedValueOnce({ ...REPLY, reply: '내일 오전이 좋아요.', suggestedQuestions: ['언제 병원에 가요?', '약은 언제 먹어요?'] });
    renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await userEvent.click(page.getByRole('button', { name: '언제 병원에 가요?' }));
    await expect.element(page.getByText('내일 오전이 좋아요.')).toBeVisible();
    expect(quickButtons()).toEqual(['병원 예약하고 싶어요', '약은 언제 먹어요?']);
  });

  it('입력창에 직접 쓴 같은 문장(앞뒤 공백 무시)도 뺀다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), '  어지러워요 ');
    await userEvent.click(page.getByRole('button', { name: '보내기' }));
    await expect.element(page.getByText('쉬어 보세요.')).toBeVisible();
    expect(quickButtons()).toEqual(['머리가 아파요', '배가 아파요', '무릎이 아파요']);
  });

  it('피보호자: 다 쓰면 칸이 줄고, 남은 문장이 없으면 입력창 안내를 보여 준다', async () => {
    api.role.mockReturnValue('WARD');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    renderChat(<ChatbotContent variant="ward" />);

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
    renderChat(<ChatbotContent variant="ward" />);

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
    renderChat(
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
    renderChat(<ChatbotContent variant="ward" />);

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
    renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('잠시 후 다시 시도해 주세요.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '무릎이 아프다고 하세요' })).toBeVisible();
  });

  it('피보호자를 바꾸면 새 대화라 보낸 문장이 다시 보인다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.wards.mockReturnValue([WARD, WARD_2]);
    api.sendChatMessage.mockResolvedValue({ ...REPLY, suggestedQuestions: [] });
    renderChat(<ChatbotContent />);

    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    expect(page.getByRole('button', { name: '무릎이 아프다고 하세요' }).elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: '이철수' }));
    await expect.element(page.getByText(/이철수의 증상을 말씀해 주시면/)).toBeVisible();
    await expect.element(page.getByRole('button', { name: '무릎이 아프다고 하세요' })).toBeVisible();
  });
});
