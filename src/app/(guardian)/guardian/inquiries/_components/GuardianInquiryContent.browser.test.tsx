// 보호자 문의하기 화면 컴포넌트 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)
// API는 모듈 목으로 바꾸고 화면 흐름(작성 -> 내역, 오류 문구, 상세 답변 표시)만 본다

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { GuardianInquiry } from '@/service/interface/guardian/inquiry';
import { GuardianInquiryContent } from './GuardianInquiryContent';

const api = vi.hoisted(() => ({
  getGuardianInquiries: vi.fn(),
  createGuardianInquiry: vi.fn(),
  getGuardianInquiryDetail: vi.fn(),
}));

vi.mock('@/service/api/guardian/inquiry', () => api);

const WAITING: GuardianInquiry = {
  id: 1,
  category: 'ANOMALY',
  title: '낙상 감지 알림이 너무 자주 와요',
  content: '거실에서 낙상 알림이 하루에 여러 번 와요',
  status: 'WAITING',
  answer: null,
  answeredAt: null,
  createdAt: '2026-08-07T10:00:00+09:00',
};

const ANSWERED: GuardianInquiry = {
  id: 2,
  category: 'HOSPITAL',
  title: '병원 예약 취소는 어떻게 하나요?',
  content: '예약을 바꾸고 싶어요',
  status: 'ANSWERED',
  answer: '병원 예약 화면의 다음 진료 카드에서 취소하실 수 있어요.',
  answeredAt: '2026-08-08T09:00:00+09:00',
  createdAt: '2026-08-07T09:00:00+09:00',
};

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GuardianInquiryContent />
    </QueryClientProvider>,
  );
}

async function openFormAndFill(screen: ReturnType<typeof renderContent>) {
  await screen.getByRole('button', { name: '문의 남기기' }).click();
  await screen.getByRole('radio', { name: '병원' }).click();
  await screen.getByRole('textbox', { name: /제목/ }).fill('예약 문의');
  await screen.getByRole('textbox', { name: /내용/ }).fill('왕진 가능한 요일이 궁금해요');
}

afterEach(() => {
  api.getGuardianInquiries.mockReset();
  api.createGuardianInquiry.mockReset();
  api.getGuardianInquiryDetail.mockReset();
  document.body.innerHTML = '';
});

describe('GuardianInquiryContent (Chrome)', () => {
  it('빈 목록이면 안내 문구를 보여 준다', async () => {
    api.getGuardianInquiries.mockResolvedValue([]);
    const screen = renderContent();
    await expect.element(screen.getByText('아직 남긴 문의가 없어요')).toBeInTheDocument();
  });

  it('분류·제목·내용이 모두 있어야 보내기가 켜지고, 글자 수와 최대 길이를 지킨다', async () => {
    api.getGuardianInquiries.mockResolvedValue([]);
    const screen = renderContent();
    await screen.getByRole('button', { name: '문의 남기기' }).click();

    const submit = screen.getByRole('button', { name: '보내기' });
    await expect.element(submit).toBeDisabled();

    await screen.getByRole('textbox', { name: /제목/ }).fill('제목만');
    await screen.getByRole('textbox', { name: /내용/ }).fill('   ');
    await expect.element(submit).toBeDisabled();

    await screen.getByRole('textbox', { name: /내용/ }).fill('내용');
    await expect.element(submit).toBeDisabled(); // 분류를 아직 안 골랐다

    await screen.getByRole('radio', { name: '이상감지' }).click();
    await expect.element(screen.getByRole('radio', { name: '이상감지' })).toHaveAttribute('aria-checked', 'true');
    await expect.element(submit).toBeEnabled();

    await expect.element(screen.getByText('3/100')).toBeInTheDocument();
    await expect.element(screen.getByText('2/2000')).toBeInTheDocument();
    await expect.element(screen.getByRole('textbox', { name: /제목/ })).toHaveAttribute('maxlength', '100');
    await expect.element(screen.getByRole('textbox', { name: /내용/ })).toHaveAttribute('maxlength', '2000');
  });

  it('등록에 성공하면 작성 카드를 닫고 안내를 띄운 뒤 목록을 다시 받는다', async () => {
    api.getGuardianInquiries.mockResolvedValueOnce([]).mockResolvedValue([WAITING]);
    let resolveCreate: (value: GuardianInquiry) => void = () => undefined;
    api.createGuardianInquiry.mockImplementation(() => new Promise(resolve => (resolveCreate = resolve)));
    const screen = renderContent();
    await openFormAndFill(screen);

    const submit = screen.getByRole('button', { name: '보내기' });
    await userEvent.dblClick(submit);
    await expect.element(screen.getByRole('button', { name: '보내는 중...' })).toBeDisabled();
    expect(api.createGuardianInquiry).toHaveBeenCalledTimes(1);
    expect(api.createGuardianInquiry).toHaveBeenCalledWith({
      category: 'HOSPITAL',
      title: '예약 문의',
      content: '왕진 가능한 요일이 궁금해요',
    });

    resolveCreate(WAITING);
    await expect.element(screen.getByRole('status')).toHaveTextContent('문의를 남겼어요');
    await expect.element(screen.getByRole('form', { name: '새 문의 작성' })).not.toBeInTheDocument();
    await expect.element(screen.getByText(WAITING.title)).toBeInTheDocument();
    expect(api.getGuardianInquiries).toHaveBeenLastCalledWith({ page: 0, size: 20 });
  });

  it.each([
    [429, '잠시 후 다시 보내 주세요'],
    [400, '입력한 내용을 다시 확인해 주세요'],
    [401, '다시 로그인해 주세요'],
  ])('등록이 %i이면 맞는 문구를 보여 주고 입력은 남긴다', async (status, text) => {
    api.getGuardianInquiries.mockResolvedValue([]);
    api.createGuardianInquiry.mockRejectedValue({ status, message: '서버 문구' });
    const screen = renderContent();
    await openFormAndFill(screen);
    await screen.getByRole('button', { name: '보내기' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent(text);
    await expect.element(screen.getByRole('textbox', { name: /제목/ })).toHaveValue('예약 문의');
    await expect.element(screen.getByRole('button', { name: '보내기' })).toBeEnabled();
  });

  it('카드는 상태를 보여 주고, 상세에서 답변 대기·완료를 구분한다', async () => {
    api.getGuardianInquiries.mockResolvedValue([WAITING, ANSWERED]);
    api.getGuardianInquiryDetail.mockImplementation((id: number) => Promise.resolve(id === 1 ? WAITING : ANSWERED));
    const screen = renderContent();

    await expect.element(screen.getByText('답변 기다리는 중')).toBeInTheDocument();
    await expect.element(screen.getByText('답변 완료')).toBeInTheDocument();
    await expect.element(screen.getByText('8월 7일').first()).toBeInTheDocument();

    await screen.getByRole('button', { name: /낙상 감지 알림.*자세히 보기/ }).click();
    const dialog = screen.getByRole('dialog', { name: '문의 상세' });
    await expect.element(dialog.getByText('아직 답변을 기다리고 있어요', { exact: false })).toBeInTheDocument();
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();

    await screen.getByRole('button', { name: /병원 예약 취소.*자세히 보기/ }).click();
    await expect.element(screen.getByRole('dialog').getByText(ANSWERED.answer!)).toBeInTheDocument();
  });

  it('남의 문의 상세(403)는 본인 문의만 볼 수 있다고 안내한다', async () => {
    api.getGuardianInquiries.mockResolvedValue([WAITING]);
    api.getGuardianInquiryDetail.mockRejectedValue({ status: 403, message: '서버 문구' });
    const screen = renderContent();
    await screen.getByRole('button', { name: /자세히 보기/ }).click();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('본인이 남긴 문의만 볼 수 있어요.');
  });

  it('375px에서 가로로 넘치지 않는다', async () => {
    api.getGuardianInquiries.mockResolvedValue([
      { ...ANSWERED, title: '아주긴제목'.repeat(20), answer: '긴답변'.repeat(200) },
    ]);
    const screen = renderContent();
    await screen.getByRole('button', { name: '문의 남기기' }).click();
    await expect.element(screen.getByText('답변 완료')).toBeInTheDocument();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
