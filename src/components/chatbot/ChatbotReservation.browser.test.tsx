// 챗봇 병원 예약 흐름 화면 테스트(2026-11-04) - 선택지·결과 카드를 실제로 그린다(ChatbotContent 테스트는 둘을 비워 둔다).
// 예약 중 칩 숨김·예약 진행 패널 / 끝나면 칩 복귀 / 말풍선엔 label / 목록 보기는 병원 가는 날 화면 /
// 보호자 예약 대상 선택(2026-11-11 - AI가 묻고, 고른 피보호자를 예약이 끝날 때까지 context.wardId 로 싣는다).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import ChatbotContent from './ChatbotContent';
import { clearSelectedWardId } from '@/store/selectedWardStore';

// 마이크 버튼 이름 - 보호자 "말로 입력하기", 피보호자는 보이는 글자와 같다(처음 "말로 물어보기"·답 뒤 "말로 답하기"·응급 뒤 "말로 더 묻기", 2026-11-12)
const MIC = /^말로 (입력하기|물어보기|답하기|더 묻기)$/;

const api = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  role: vi.fn(),
  wards: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('@/service/api/chat', () => ({
  sendChatMessage: api.sendChatMessage,
  getChatLogs: vi.fn(),
  getChatErrorMessage: () => '잠시 후 다시 시도해 주세요.',
}));
vi.mock('@/service/api/chatPolicy', () => ({ getHistoryWarning: () => null }));
vi.mock('@/service/query/user/profile', () => ({
  myProfileQueryOptions: { queryKey: ['test-profile'], queryFn: () => ({ name: '박순자', profileImage: null }) },
}));
vi.mock('@/utils/auth/userProfile', () => ({ getUserProfileData: (response: unknown) => response }));
vi.mock('@/lib/auth/tokenStore', () => ({ getAuthRole: api.role, getAccessTokenSubject: () => 'user-1' }));
vi.mock('@/hooks/useActiveConnections', () => ({
  useGuardianActiveWards: (enabled: boolean) => ({ activeWards: enabled ? api.wards() : [], isLoading: false }),
}));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));
vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => <span data-testid="avatar" /> }));

const WARD = {
  partnerUserId: 'ward-1',
  partnerName: '김영희',
  relation: '딸',
  partnerProfileImage: null,
};
const WARD_2 = { ...WARD, partnerUserId: 'ward-2', partnerName: '이철수' };

const DEPARTMENT_ADVICE = {
  reply: '정형외과 진료를 권해요.',
  engine: 'ai',
  type: 'message',
  intent: 'medical_advice',
  ui: { kind: 'select', field: 'department', options: [{ value: '정형외과', label: '가까운 정형외과 찾기' }] },
};

const ASK_SIDO = {
  reply: '어느 지역에서 찾을까요?',
  engine: 'ai',
  type: 'message',
  intent: 'hospital_reservation',
  ui: {
    kind: 'select',
    field: 'location_sido',
    label: '시·도를 골라 주세요',
    options: [
      { value: '서울', label: '서울' },
      { value: '부산', label: '부산' },
      { value: '__type__', label: '직접 입력' },
    ],
  },
};

const ASK_DATE = {
  reply: '언제 가실까요?',
  engine: 'ai',
  type: 'message',
  intent: 'hospital_reservation',
  // AI #175: 가까운 날은 선택지, 끝에 달력 고르기(__calendar__)
  ui: {
    kind: 'select',
    field: 'date',
    label: '서초내과 · 정형외과 예약 날짜를 선택해 주세요.',
    options: [
      { value: '2026-11-04', label: '오늘 11월 4일(수)' },
      { value: '2026-11-05', label: '내일 11월 5일(목)' },
      { value: '2026-11-06', label: '11월 6일(금)' },
      { value: '__calendar__', label: '달력에서 다른 날 고르기' },
    ],
  },
};

const ASK_CALENDAR = {
  reply: '달력에서 골라 주세요.',
  engine: 'ai',
  type: 'message',
  intent: 'hospital_reservation',
  ui: { kind: 'date', field: 'date', label: '진료 날짜를 골라 주세요.' },
};

const ASK_PHONE = {
  reply: '연락처가 필요해요.',
  engine: 'ai',
  type: 'message',
  intent: 'hospital_reservation',
  ui: { kind: 'text', field: 'phone', label: '연락받을 전화번호를 입력해 주세요.' },
};

const DONE = {
  reply: '예약했어요.',
  engine: 'ai',
  type: 'tool_result',
  intent: 'hospital_reservation',
  tool: 'make_appointment',
  toolData: { hospital_name: '튼튼정형외과', department: '정형외과', date: '2026-12-01', time: '10:30', patient_name: '박순자' },
  ui: {
    kind: 'select',
    field: 'reservation_followup',
    label: '예약 목록을 보여드릴까요?',
    options: [
      { value: 'show_list', label: '예약 목록 보기' },
      { value: 'stay', label: '계속 상담하기' },
    ],
  },
};

// AI #255·#256: 보호자가 wardId 없이 예약을 시작하면 대상을 먼저 묻는다(보호자 본인 선택지는 없다)
const ASK_TARGET = {
  reply: '누구의 병원 예약인가요?',
  engine: 'ai',
  type: 'ui',
  intent: 'hospital_reservation',
  ui: {
    kind: 'select',
    field: 'reservation_patient',
    label: '누구의 병원 예약인가요?',
    options: [
      { value: 'ward-1', label: '김영희(딸)' },
      { value: 'ward-2', label: '이철수(아들)' },
    ],
  },
};

const GENERAL = { reply: '좋아요.', engine: 'ai', type: 'message', intent: 'general_chat' };

/** 보호자: 예약 칩 → 대상 질문 → 이철수 선택 → 시·도 질문까지 */
async function startGuardianReservationFor(label = '이철수(아들)') {
  api.sendChatMessage.mockResolvedValueOnce(ASK_TARGET).mockResolvedValueOnce(ASK_SIDO);
  const screen = await renderChat(<ChatbotContent />);
  await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
  await userEvent.click(page.getByRole('button', { name: label }));
  await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();
  return screen;
}

function contextOf(call: number) {
  return api.sendChatMessage.mock.calls[call][0].context;
}

async function typeAndSend(text: string) {
  await userEvent.fill(page.getByRole('textbox', { name: '궁금한 점 입력' }), text);
  await userEvent.click(page.getByRole('button', { name: '보내기' }));
}

function renderChat(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

/** 피보호자: 증상 → 진료과 버튼 → 예약 시작(시·도 선택)까지 */
async function startWardReservation() {
  api.sendChatMessage.mockResolvedValueOnce(DEPARTMENT_ADVICE).mockResolvedValueOnce(ASK_SIDO);
  await renderChat(<ChatbotContent variant="ward" />);
  await userEvent.click(page.getByRole('button', { name: '무릎이 아파요' }));
  await userEvent.click(page.getByRole('button', { name: '가까운 정형외과 찾기' }));
  await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();
}

beforeEach(() => {
  // 대화는 탭 저장소에 남는다(2026-11-11) - 앞 테스트의 대화가 이어지지 않게 비운다
  window.sessionStorage.clear();
  api.sendChatMessage.mockReset();
  api.push.mockReset();
  api.wards.mockReturnValue([WARD, WARD_2]);
  clearSelectedWardId();
});

describe('피보호자 챗봇 예약', () => {
  beforeEach(() => {
    api.role.mockReturnValue('WARD');
  });

  it('진료과 버튼(예약 전)까지는 칩이 남고, 예약이 시작되면 칩 대신 예약 진행 패널과 큰 선택지를 보인다', async () => {
    api.sendChatMessage.mockResolvedValueOnce(DEPARTMENT_ADVICE).mockResolvedValueOnce(ASK_SIDO);
    await renderChat(<ChatbotContent variant="ward" />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아파요' }));

    await expect.element(page.getByText('정형외과 진료를 권해요.')).toBeVisible();
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: '가까운 정형외과 찾기' }));
    await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();

    await expect.element(page.getByRole('region', { name: '추천 질문' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('region', { name: '예약 진행' })).toBeVisible();
    // 같은 선택지를 말풍선과 패널에 두 번 그리지 않는다
    expect(page.getByRole('button', { name: '서울' }).elements()).toHaveLength(1);
    const seoul = page.getByRole('button', { name: '서울' }).element() as HTMLElement;
    expect(seoul.getBoundingClientRect().height).toBeGreaterThanOrEqual(60);
    expect(Number.parseFloat(getComputedStyle(seoul).fontSize)).toBeGreaterThanOrEqual(20);
  });

  it('예약 중에도 입력은 큰 마이크 버튼 하나 - 입력창·[직접 써서 답하기]는 없다(2026-11-11)', async () => {
    await startWardReservation();

    await expect.element(page.getByRole('button', { name: MIC })).toBeVisible();
    expect(page.getByRole('textbox', { name: '궁금한 점 입력' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: '직접 써서 답하기' }).elements()).toHaveLength(0);
  });

  it('선택지를 누르면 value 가 아니라 label 이 내 말풍선에 보인다', async () => {
    await startWardReservation();
    api.sendChatMessage.mockResolvedValueOnce({ reply: '지역을 적어 주세요.', engine: 'ai', type: 'message' });

    await userEvent.click(page.getByRole('button', { name: '직접 입력' }));

    await expect.element(page.getByText('지역을 적어 주세요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[2][0].uiSelection).toEqual({ field: 'location_sido', value: '__type__' });
    expect(page.getByText('직접 입력', { exact: true }).elements().length).toBeGreaterThan(0);
    await expect.element(page.getByText('__type__')).not.toBeInTheDocument();
  });

  it('날짜는 AI 선택지를 큰 버튼으로 고르고, 말풍선엔 값이 아니라 "내일 11월 5일(목)"이 보인다', async () => {
    await startWardReservation();
    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));
    await expect.element(page.getByText('언제 가실까요?')).toBeVisible();

    // 날짜 선택지 4개 + 맨 아래 [예약 그만하기]
    const panelButtons = page.getByRole('region', { name: '예약 진행' }).getByRole('button').elements();
    expect(panelButtons).toHaveLength(5);
    expect(panelButtons.at(-1)?.textContent).toBe('예약 그만하기');
    // 단계 표시: 진료과·병원 마침, 지금은 날짜(2026-11-12 - 묻는 칸으로 정한다)
    const steps = page.getByRole('list', { name: '예약 단계' });
    await expect.element(steps).toBeVisible();
    expect(steps.element().querySelector('[aria-current="step"]')?.textContent).toBe('3날짜');
    api.sendChatMessage.mockResolvedValueOnce(ASK_SIDO);
    await userEvent.click(page.getByRole('button', { name: '내일 11월 5일(목)' }));

    expect(api.sendChatMessage.mock.calls[3][0].uiSelection).toEqual({ field: 'date', value: '2026-11-05' });
    await expect.element(page.getByText('내일 11월 5일(목)', { exact: true })).toBeVisible();
    await expect.element(page.getByText('2026-11-05')).not.toBeInTheDocument();
  });

  it('[달력에서 다른 날 고르기] 뒤 달력 단계는 날짜 버튼 없이 달력을 바로 펼친다', async () => {
    await startWardReservation();
    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));
    api.sendChatMessage.mockResolvedValueOnce(ASK_CALENDAR);
    await userEvent.click(page.getByRole('button', { name: '달력에서 다른 날 고르기' }));

    await expect.element(page.getByText('달력에서 골라 주세요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[3][0].uiSelection).toEqual({ field: 'date', value: '__calendar__' });
    await expect.element(page.getByText('__calendar__')).not.toBeInTheDocument();
    const panel = page.getByRole('region', { name: '예약 진행' });
    await expect.element(panel.getByLabelText('진료 날짜를 골라 주세요.')).toBeVisible();
    expect(panel.getByRole('button').elements().map(b => b.textContent)).toEqual(['적용', '예약 그만하기']);
  });

  it('전화번호 칸이 오면 입력 칸 없이 안내하고, [처음으로 돌아가기]는 새 대화로 시작한다', async () => {
    await startWardReservation();
    api.sendChatMessage.mockResolvedValueOnce(ASK_PHONE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));

    await expect.element(page.getByText(/등록된 전화번호가 없어/)).toBeVisible();
    expect(page.getByRole('region', { name: '예약 진행' }).getByRole('textbox').elements()).toHaveLength(0);

    const firstSession = api.sendChatMessage.mock.calls[0][0].sessionId;
    await userEvent.click(page.getByRole('button', { name: '처음으로 돌아가기' }));
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    await expect.element(page.getByText('연락처가 필요해요.')).not.toBeInTheDocument();

    api.sendChatMessage.mockResolvedValueOnce({ reply: '좋아요.', engine: 'ai', type: 'message' });
    await userEvent.click(page.getByRole('button', { name: '머리가 아파요' }));
    await expect.element(page.getByText('좋아요.')).toBeVisible();
    expect(api.sendChatMessage.mock.calls.at(-1)?.[0].sessionId).not.toBe(firstSession);
  });

  it('예약이 끝나면 병원 가는 날 카드와 칩이 돌아오고, [예약 목록 보기]는 AI로 보내지 않고 /ward/hospital 로 간다', async () => {
    await startWardReservation();
    api.sendChatMessage.mockResolvedValueOnce(DONE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));

    const card = page.getByRole('region', { name: '예약 완료' });
    await expect.element(card).toBeVisible();
    await expect.element(card.getByText('병원 가는 날')).toBeVisible();
    await expect.element(card.getByText('12월 1일 화요일')).toBeVisible();
    await expect.element(card.getByText('오전 10시 30분')).toBeVisible();
    await expect.element(card.getByText(/튼튼정형외과/)).toBeVisible();
    // 같은 답의 [예약 목록 보기] 선택지와 겹치지 않게 카드 버튼은 숨긴다
    await expect.element(page.getByRole('button', { name: '병원 가는 날 보기' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: MIC })).toBeVisible();

    const calls = api.sendChatMessage.mock.calls.length;
    await userEvent.click(page.getByRole('button', { name: '예약 목록 보기' }));
    await expect.poll(() => api.push.mock.calls).toEqual([['/ward/hospital']]);
    expect(api.sendChatMessage.mock.calls).toHaveLength(calls);
    await expect.element(page.getByText('show_list')).not.toBeInTheDocument();
  });
});

describe('보호자 챗봇 예약', () => {
  beforeEach(() => {
    api.role.mockReturnValue('GUARDIAN');
  });

  it('예약을 시작하면 대상 질문을 예약 진행 패널에 보이고, 고른 피보호자를 그 턴부터 예약이 끝날 때까지 싣는다 (2026-11-11)', async () => {
    api.sendChatMessage.mockResolvedValueOnce(ASK_TARGET);
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
    await expect.element(page.getByRole('region', { name: '예약 진행' })).toBeVisible();
    expect(contextOf(0)).toEqual({ role: 'GUARDIAN' });
    await expect.element(page.getByRole('button', { name: '병원 예약하고 싶어요' })).not.toBeInTheDocument();
    const pick = page.getByRole('button', { name: '이철수(아들)' });
    expect((pick.element() as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);

    // 선택 턴: uiSelection 과 같은 값을 context.wardId 로(BE는 둘이 다르면 400)
    api.sendChatMessage.mockResolvedValueOnce(ASK_SIDO);
    await userEvent.click(pick);
    await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[1][0].uiSelection).toEqual({ field: 'reservation_patient', value: 'ward-2' });
    expect(contextOf(1)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });
    expect(page.getByText('이철수(아들)', { exact: true }).elements().length).toBeGreaterThan(0);
    await expect.element(page.getByText('ward-2')).not.toBeInTheDocument();

    // 예약 중 글 입력: 직전 답이 wardId 요청의 예약 답이라 싣는다
    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await typeAndSend('서울이요');
    await expect.element(page.getByText('언제 가실까요?')).toBeVisible();
    expect(contextOf(2)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });

    // 예약 중 버튼: 그 버튼이 달린 답을 받은 요청의 wardId
    api.sendChatMessage.mockResolvedValueOnce(DONE);
    await userEvent.click(page.getByRole('button', { name: '내일 11월 5일(목)' }));
    await expect.element(page.getByRole('region', { name: '예약 완료' })).toBeVisible();
    expect(contextOf(3)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });

    // 완료(make_appointment) 뒤 글 입력: 예약이 끝났으니 본인 상담
    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await typeAndSend('고마워요');
    await expect.element(page.getByText('좋아요.')).toBeVisible();
    expect(contextOf(4)).toEqual({ role: 'GUARDIAN' });
    // 보호자 입력창은 그대로 둔다
    await expect.element(page.getByRole('textbox', { name: '궁금한 점 입력' })).toBeVisible();
  });

  it('예약 흐름이 아닌 답(intent 일반)이 오면 다음 글 입력부터 싣지 않는다 (2026-11-11)', async () => {
    await startGuardianReservationFor();
    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await typeAndSend('그만할게요');
    await expect.element(page.getByText('좋아요.')).toBeVisible();
    expect(contextOf(2)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });

    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await typeAndSend('허리가 아파요');
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(4));
    expect(contextOf(3)).toEqual({ role: 'GUARDIAN' });
  });

  it('코드 값(__self__) 선택지는 피보호자가 아니라 싣지 않는다 (원래 계약 값, AI는 지금 내지 않는다)', async () => {
    api.sendChatMessage.mockResolvedValueOnce({
      ...ASK_TARGET,
      ui: { ...ASK_TARGET.ui, options: [{ value: '__self__', label: '나' }, ...ASK_TARGET.ui.options] },
    });
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await userEvent.click(page.getByRole('button', { name: '나', exact: true }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2));
    expect(contextOf(1)).toEqual({ role: 'GUARDIAN' });
  });

  it('[새 대화]를 열면 고른 예약 대상이 풀린다 (2026-11-11)', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await startGuardianReservationFor();
    await userEvent.click(page.getByRole('button', { name: '새 대화' }));
    await expect.element(page.getByText('어느 지역에서 찾을까요?')).not.toBeInTheDocument();

    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await typeAndSend('서울이요');
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(3));
    expect(contextOf(2)).toEqual({ role: 'GUARDIAN' });
    expect(api.sendChatMessage.mock.calls[2][0].sessionId).not.toBe(api.sendChatMessage.mock.calls[1][0].sessionId);
    confirm.mockRestore();
  });

  it('화면을 옮겼다 돌아와도 예약 중이면 고른 대상을 이어 싣는다 (2026-11-11)', async () => {
    const first = await startGuardianReservationFor();
    await first.unmount();

    await renderChat(<ChatbotContent />);
    await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();
    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(3));
    expect(contextOf(2)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });
  });

  it('전화번호 칸이 오면 보호자 문구로 안내한다', async () => {
    api.sendChatMessage.mockResolvedValueOnce(ASK_PHONE);
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText(/피보호자 전화번호가 등록되어 있지 않아/)).toBeVisible();
  });

  it('본인 예약 답의 [예약 목록 보기]는 /guardian/hospital 로 가고 전역 피보호자 선택은 건드리지 않는다', async () => {
    api.sendChatMessage.mockResolvedValueOnce(DONE);
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await userEvent.click(page.getByRole('button', { name: '예약 목록 보기' }));
    await expect.poll(() => api.push.mock.calls).toEqual([['/guardian/hospital']]);
    expect(sessionStorage.getItem('careai_selected_ward_id')).toBeNull();
  });

  it('대리 예약 답의 [예약 목록 보기]는 그 피보호자를 전역 선택으로 맞춘 뒤 옮기고, 돌아와도 "답 없음" 안내가 없다 (2026-11-11)', async () => {
    const first = await startGuardianReservationFor();
    api.sendChatMessage.mockResolvedValueOnce(DONE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));
    await expect.element(page.getByRole('region', { name: '예약 완료' })).toBeVisible();
    const calls = api.sendChatMessage.mock.calls.length;

    await userEvent.click(page.getByRole('button', { name: '예약 목록 보기' }));
    await expect.poll(() => api.push.mock.calls).toEqual([['/guardian/hospital']]);
    expect(sessionStorage.getItem('careai_selected_ward_id')).toBe('ward-2');
    expect(api.sendChatMessage.mock.calls).toHaveLength(calls);
    await first.unmount();

    await renderChat(<ChatbotContent />);
    await expect.element(page.getByRole('region', { name: '예약 완료' })).toBeVisible();
    expect(page.getByText(/답을 받기 전에 화면을 옮겨서/).elements()).toHaveLength(0);
  });
});

describe('보호자 대리 예약 기능 점검 반영 (2026-11-11)', () => {
  beforeEach(() => {
    api.role.mockReturnValue('GUARDIAN');
  });

  const NOT_CONNECTED = { response: { status: 403, data: { code: 'CHAT_WARD_NOT_CONNECTED' } } };

  it('대리 예약 중 연결이 끊겨 거절되면 안내하고 예약 패널을 닫으며, 다음 입력부터 wardId 를 싣지 않는다 (M-1)', async () => {
    await startGuardianReservationFor();
    api.sendChatMessage.mockRejectedValueOnce(NOT_CONNECTED);
    await typeAndSend('서울이요');
    await expect.element(page.getByText(/연결되어 있지 않아 예약을 이어갈 수 없어요/)).toBeVisible();
    expect(contextOf(2)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });
    await expect.element(page.getByRole('region', { name: '예약 진행' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('region', { name: '추천 질문' })).toBeVisible();

    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await typeAndSend('허리가 아파요');
    await expect.element(page.getByText('좋아요.')).toBeVisible();
    expect(contextOf(3)).toEqual({ role: 'GUARDIAN' });
  });

  it('화면을 옮겼다 돌아와도 끊긴 상태는 이어진다 - 저장한 대화에서 다시 싣지 않는다 (M-1)', async () => {
    const first = await startGuardianReservationFor();
    api.sendChatMessage.mockRejectedValueOnce(NOT_CONNECTED);
    await typeAndSend('서울이요');
    await expect.element(page.getByText(/연결되어 있지 않아 예약을 이어갈 수 없어요/)).toBeVisible();
    await first.unmount();

    await renderChat(<ChatbotContent />);
    await expect.element(page.getByText(/연결되어 있지 않아 예약을 이어갈 수 없어요/)).toBeVisible();
    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await typeAndSend('허리가 아파요');
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(4));
    expect(contextOf(3)).toEqual({ role: 'GUARDIAN' });
  });

  it('그 밖의 실패(네트워크 등)는 예약을 이어 간다 - 다시 보내면 같은 wardId (M-1 경계)', async () => {
    await startGuardianReservationFor();
    api.sendChatMessage.mockRejectedValueOnce(new Error('network'));
    await typeAndSend('서울이요');
    await expect.element(page.getByText('잠시 후 다시 시도해 주세요.')).toBeVisible();
    await expect.element(page.getByRole('region', { name: '예약 진행' })).toBeVisible();

    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await typeAndSend('서울이요');
    await expect.element(page.getByText('언제 가실까요?')).toBeVisible();
    expect(contextOf(3)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });
  });

  it('지난 답의 카드 버튼은 그 답을 받은 요청의 wardId 를 싣는다 - 본인 답 카드는 없음, 대리 답 카드는 그 피보호자 (L-2)', async () => {
    const search = (name: string) => ({
      reply: '병원을 찾았어요.',
      engine: 'ai',
      type: 'tool_result',
      intent: 'hospital_reservation',
      tool: 'search_hospital',
      toolData: [{ id: name, name, department: '정형외과', address: '서울' }],
    });
    // 본인 답(병원 검색) → 예약 칩 → 대상 질문 → 이철수 → 대리 답(병원 검색)
    api.sendChatMessage
      .mockResolvedValueOnce(search('본인병원'))
      .mockResolvedValueOnce(ASK_TARGET)
      .mockResolvedValueOnce(search('대리병원'));
    await renderChat(<ChatbotContent />);
    await typeAndSend('근처 정형외과 찾아줘');
    await expect.element(page.getByText('본인병원')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: '병원 예약하고 싶어요' }));
    await userEvent.click(page.getByRole('button', { name: '이철수(아들)' }));
    await expect.element(page.getByText('대리병원')).toBeVisible();
    expect(contextOf(1)).toEqual({ role: 'GUARDIAN' });
    expect(contextOf(2)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });

    const reserve = page.getByRole('button', { name: '예약하기' });
    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await userEvent.click(reserve.nth(0));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(4));
    expect(api.sendChatMessage.mock.calls[3][0].uiSelection).toEqual({ field: 'hospital_confirm', value: '본인병원' });
    expect(contextOf(3)).toEqual({ role: 'GUARDIAN' });

    api.sendChatMessage.mockResolvedValueOnce(GENERAL);
    await userEvent.click(reserve.nth(1));
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(5));
    expect(api.sendChatMessage.mock.calls[4][0].uiSelection).toEqual({ field: 'hospital_confirm', value: '대리병원' });
    expect(contextOf(4)).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });
  });
});

describe('예약 화면 점검 반영(2026-11-04)', () => {
  it('예약 선택 뒤 보내기에 실패하면 안내를 보이고 같은 단계 선택지를 패널에 남겨 다시 고를 수 있다', async () => {
    api.role.mockReturnValue('WARD');
    await startWardReservation();
    api.sendChatMessage.mockRejectedValueOnce(new Error('network'));
    await userEvent.click(page.getByRole('button', { name: '서울' }));

    await expect.element(page.getByText('잠시 후 다시 시도해 주세요.')).toBeVisible();
    await expect.element(page.getByRole('region', { name: '예약 진행' })).toBeVisible();
    await expect.element(page.getByRole('region', { name: '추천 질문' })).not.toBeInTheDocument();

    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));
    await expect.element(page.getByText('언제 가실까요?')).toBeVisible();
    expect(api.sendChatMessage.mock.calls.at(-1)?.[0].uiSelection).toEqual({ field: 'location_sido', value: '서울' });
  });

  it('병원 이름·예약 ID가 빈 항목에는 예약하기·상세 버튼을 두지 않는다(빈 값으로 보내지 않음)', async () => {
    api.role.mockReturnValue('GUARDIAN');
    api.sendChatMessage.mockResolvedValueOnce({
      reply: '병원을 찾았어요.',
      engine: 'ai',
      type: 'tool_result',
      intent: 'hospital_reservation',
      tool: 'search_hospital',
      toolData: [{ id: 1, name: '튼튼정형외과' }, { id: 2, name: '  ' }],
    }).mockResolvedValueOnce({
      reply: '예약 목록이에요.',
      engine: 'ai',
      type: 'tool_result',
      intent: 'hospital_reservation',
      tool: 'list_my_appointments',
      toolData: [{ reservation_id: 7, hospital_name: '튼튼정형외과' }, { hospital_name: 'ID 없는 병원' }],
    });
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText('병원을 찾았어요.')).toBeVisible();
    expect(page.getByRole('button', { name: '예약하기', exact: true }).elements()).toHaveLength(1);

    await userEvent.click(page.getByRole('button', { name: '혈압약을 같이 먹어도 되나요?' }));
    await expect.element(page.getByText('예약 목록이에요.')).toBeVisible();
    expect(page.getByRole('button', { name: '상세', exact: true }).elements()).toHaveLength(1);
  });
});
