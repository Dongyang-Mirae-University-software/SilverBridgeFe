// 챗봇 병원 예약 흐름 화면 테스트(2026-11-04) - 선택지·결과 카드를 실제로 그린다(ChatbotContent 테스트는 둘을 비워 둔다).
// 예약 중 칩 숨김·예약 진행 패널 / 끝나면 칩 복귀 / 말풍선엔 label / 목록 보기는 병원 가는 날 화면 / 보호자 피보호자 선택.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import ChatbotContent from './ChatbotContent';
import { clearSelectedWardId } from '@/store/selectedWardStore';

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

    await expect.element(page.getByRole('button', { name: '말로 입력하기' })).toBeVisible();
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

    expect(page.getByRole('region', { name: '예약 진행' }).getByRole('button').elements()).toHaveLength(4);
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
    expect(panel.getByRole('button').elements().map(b => b.textContent)).toEqual(['적용']);
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
    await expect.element(page.getByRole('button', { name: '말로 입력하기' })).toBeVisible();

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

  it('고른 피보호자로 대리 상담하고, 예약 중에는 칩 줄 대신 예약 진행 패널(버튼 48px 이상)을 보인다', async () => {
    api.sendChatMessage.mockResolvedValueOnce(DEPARTMENT_ADVICE).mockResolvedValueOnce(ASK_SIDO);
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '이철수' }));
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await userEvent.click(page.getByRole('button', { name: '가까운 정형외과 찾기' }));
    await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();

    expect(api.sendChatMessage.mock.calls[1][0].context).toEqual({ role: 'GUARDIAN', wardId: 'ward-2' });
    await expect.element(page.getByRole('button', { name: '병원 예약하고 싶어요' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('region', { name: '예약 진행' })).toBeVisible();
    const seoul = page.getByRole('button', { name: '서울' }).element() as HTMLElement;
    expect(seoul.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    // 보호자 입력창은 그대로 둔다
    await expect.element(page.getByRole('textbox', { name: '궁금한 점 입력' })).toBeVisible();
  });

  it('전화번호 칸이 오면 보호자 문구로 안내한다', async () => {
    api.sendChatMessage.mockResolvedValueOnce(ASK_PHONE);
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await expect.element(page.getByText(/피보호자 전화번호가 등록되어 있지 않아/)).toBeVisible();
  });

  it('[예약 목록 보기]는 /guardian/hospital 로 간다', async () => {
    api.sendChatMessage.mockResolvedValueOnce(DONE);
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));
    await userEvent.click(page.getByRole('button', { name: '예약 목록 보기' }));
    await expect.poll(() => api.push.mock.calls).toEqual([['/guardian/hospital']]);
  });
});

describe('예약 화면 점검 반영(2026-11-04)', () => {
  it('보호자: 답을 기다리는 중에는 피보호자를 바꾸지 않아 그 답이 다른 피보호자 대화에 붙지 않는다', async () => {
    api.role.mockReturnValue('GUARDIAN');
    let resolve: (value: unknown) => void = () => {};
    api.sendChatMessage.mockImplementationOnce(() => new Promise(r => (resolve = r)));
    await renderChat(<ChatbotContent />);
    await userEvent.click(page.getByRole('button', { name: '무릎이 아프다고 하세요' }));

    await userEvent.click(page.getByRole('button', { name: '이철수' }));
    resolve(ASK_SIDO);
    await expect.element(page.getByText('어느 지역에서 찾을까요?')).toBeVisible();
    await expect.element(page.getByText(/김영희의 증상을/)).toBeVisible();

    api.sendChatMessage.mockResolvedValueOnce(ASK_DATE);
    await userEvent.click(page.getByRole('button', { name: '서울' }));
    await expect.element(page.getByText('언제 가실까요?')).toBeVisible();
    expect(api.sendChatMessage.mock.calls[1][0].context).toEqual({ role: 'GUARDIAN', wardId: 'ward-1' });
    expect(api.sendChatMessage.mock.calls[1][0].sessionId).toBe(api.sendChatMessage.mock.calls[0][0].sessionId);
  });

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
