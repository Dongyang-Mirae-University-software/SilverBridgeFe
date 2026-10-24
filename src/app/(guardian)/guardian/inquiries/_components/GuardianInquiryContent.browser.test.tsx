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

  // 점검 L-2: 같은 순간 두 번 눌러도(다시 그리기 전) 한 번만 보낸다 - ref 가드
  it('같은 순간 연속 클릭도 한 번만 보낸다', async () => {
    api.getGuardianInquiries.mockResolvedValue([]);
    api.createGuardianInquiry.mockReturnValue(new Promise(() => undefined));
    const screen = renderContent();
    await openFormAndFill(screen);

    const submit = screen.getByRole('button', { name: '보내기' }).element() as HTMLButtonElement;
    submit.click();
    submit.click();
    await expect.element(screen.getByRole('button', { name: '보내는 중...' })).toBeDisabled();
    expect(api.createGuardianInquiry).toHaveBeenCalledTimes(1);
  });

  // 점검 L-2: 분류·제목이 있어도 내용이 공백뿐이면 보내지 못한다
  it('내용이 공백뿐이면 보내기가 꺼진다', async () => {
    api.getGuardianInquiries.mockResolvedValue([]);
    const screen = renderContent();
    await openFormAndFill(screen);
    await screen.getByRole('textbox', { name: /내용/ }).fill('   \n  ');
    await expect.element(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  });

  // 점검 L-2·L-3: 2페이지에서 등록하면 1페이지로 돌아가고, 넘긴 빈 페이지는 "더 이상 없음"
  it('2페이지 빈 목록은 끝이라고 알리고, 거기서 등록하면 1페이지를 다시 받는다', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({ ...WAITING, id: 100 + i, title: `문의 ${i}` }));
    api.getGuardianInquiries.mockImplementation(({ page }: { page: number }) => Promise.resolve(page === 0 ? twenty : []));
    api.createGuardianInquiry.mockResolvedValue(WAITING);
    const screen = renderContent();

    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByText('더 이상 문의가 없어요')).toBeInTheDocument();
    expect(api.getGuardianInquiries).toHaveBeenLastCalledWith({ page: 1, size: 20 });

    await openFormAndFill(screen);
    await screen.getByRole('button', { name: '보내기' }).click();
    await expect.element(screen.getByRole('status')).toHaveTextContent('문의를 남겼어요');
    await expect.element(screen.getByText('문의 0')).toBeInTheDocument();
    expect(api.getGuardianInquiries).toHaveBeenLastCalledWith({ page: 0, size: 20 });
  });

  // 점검 L-1: 입력 검증 실패는 BE의 칸별 문구를 보여 주고, 입력을 고치면 지운다
  it('400 INVALID_INPUT이면 서버 문구를 보여 주고 입력을 고치면 지운다', async () => {
    api.getGuardianInquiries.mockResolvedValue([]);
    api.createGuardianInquiry.mockRejectedValue({ status: 400, code: 'INVALID_INPUT', message: '제목을 입력해주세요.' });
    const screen = renderContent();
    await openFormAndFill(screen);
    await screen.getByRole('button', { name: '보내기' }).click();

    await expect.element(screen.getByRole('alert')).toHaveTextContent('제목을 입력해주세요.');
    await screen.getByRole('textbox', { name: /제목/ }).fill('다시 쓴 제목');
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  // 점검 L-5: 분류 칩은 Tab이 한 번만 멈추고 방향키로 고른다
  it('분류 칩은 방향키로 이동하며 고른다', async () => {
    api.getGuardianInquiries.mockResolvedValue([]);
    const screen = renderContent();
    await screen.getByRole('button', { name: '문의 남기기' }).click();

    const radios = screen.getByRole('radio').elements();
    expect(radios.map(radio => radio.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);

    (radios[0] as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(screen.getByRole('radio', { name: '병원' })).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(radios[1]);

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect.element(screen.getByRole('radio', { name: '기타' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '기타' }).element().getAttribute('tabindex')).toBe('0');
  });

  // 점검 L-4: 상세는 열리면 포커스를 받고, Esc로 닫으면 카드로 돌려준다. Tab은 모달 안에서 돈다
  it('상세 모달은 포커스를 가두고 Esc로 닫힌다', async () => {
    api.getGuardianInquiries.mockResolvedValue([WAITING]);
    api.getGuardianInquiryDetail.mockResolvedValue(WAITING);
    const screen = renderContent();

    const card = screen.getByRole('button', { name: /자세히 보기/ });
    await card.click();
    const dialog = screen.getByRole('dialog', { name: '문의 상세' });
    await expect.element(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInTheDocument();
    expect(document.activeElement).toBe(dialog.element());

    await userEvent.keyboard('{Tab}{Tab}{Tab}');
    expect(dialog.element().contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(card.element());
  });
});
