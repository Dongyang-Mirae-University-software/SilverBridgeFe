// 보호자 대화 보기 - 기분 요약·대답마다 기분은 항상, 글은 동의(AVAILABLE)일 때만. 실제 Chrome에서 돈다
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { ICompanionSessionDetail } from '@/service/interface/guardian/companion';
import { GuardianCompanionSessionContent } from './GuardianCompanionSessionContent';

const data = vi.hoisted(() => ({
  params: { sessionId: '77' } as Record<string, string>,
  search: 'wardId=w1',
  session: vi.fn<(wardId: string, sessionId: number) => Promise<unknown>>(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => data.params,
  useSearchParams: () => new URLSearchParams(data.search),
}));
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/service/query/guardian', () => ({
  wardCompanionSessionQueryOptions: (wardId: string, sessionId: number) =>
    queryOptions({ queryKey: ['test-session', wardId, sessionId], queryFn: () => data.session(wardId, sessionId) }),
}));

const SESSION: ICompanionSessionDetail = {
  sessionId: 77,
  date: '2026-11-11',
  slot: '12:00',
  question: '점심은 무엇을 드셨어요?',
  status: 'FINISHED',
  mood: 'WORRY',
  test: false,
  turnCount: 2,
  negativeCount: 1,
  riskAlerted: false,
  endedAt: '2026-11-11T12:10:00+09:00',
  turns: [
    { turnNo: 1, mood: 'CALM', answerText: '국수 먹었어', botText: '국수 맛있으셨겠어요. 누구랑 드셨어요?' },
    { turnNo: 2, mood: 'WORRY', answerText: '혼자 먹었지', botText: '그러셨군요.' },
  ],
  transcript: 'AVAILABLE',
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuardianCompanionSessionContent />
    </QueryClientProvider>,
  );
}

function apiError(status: number, code: string) {
  return new AxiosError('error', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, code },
  });
}

beforeEach(() => {
  data.params = { sessionId: '77' };
  data.search = 'wardId=w1';
  data.session.mockReset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('대화 보기 (Chrome)', () => {
  it('동의한 대화는 기분 요약·대답마다 기분·나눈 이야기를 보이고, 말벗 문장은 문장마다 줄을 나눈다', async () => {
    data.session.mockResolvedValue(SESSION);
    await renderDetail();

    await expect.element(page.getByRole('region', { name: '기분 요약' })).toMatchTextContent('11월 11일 수요일 · 낮 12시대화 기분 걱정2번 대답 · 걱정·우울 1번');
    expect(data.session).toHaveBeenCalledWith('w1', 77);
    await expect.element(page.getByRole('listitem', { name: '1번째 대답 기분 평온' })).toBeVisible();
    await expect.element(page.getByRole('listitem', { name: '2번째 대답 기분 걱정' })).toBeVisible();

    const lines = [...document.querySelectorAll('[aria-labelledby="companion-transcript"] li')].map(li => li.textContent);
    expect(lines).toEqual([
      '말벗점심은 무엇을 드셨어요?',
      '어르신국수 먹었어',
      '말벗국수 맛있으셨겠어요. 누구랑 드셨어요?',
      '어르신혼자 먹었지',
      '말벗그러셨군요.',
    ]);
    const first = page.getByText('국수 맛있으셨겠어요.', { exact: true }).element() as HTMLElement;
    const second = page.getByText('누구랑 드셨어요?', { exact: true }).element() as HTMLElement;
    expect(second.getBoundingClientRect().top).toBeGreaterThan(first.getBoundingClientRect().top);
  });

  it.each([
    ['NO_CONSENT', '어르신이 대화 내용 공유에 동의하지 않아 기분만 보여 드려요.'],
    ['EXPIRED', '보관 기간이 지나 대화 내용을 지웠어요. 기분만 보여 드려요.'],
  ] as const)('%s면 안내만 보이고 글은 없다(기분은 보인다)', async (transcript, text) => {
    data.session.mockResolvedValue({
      ...SESSION,
      transcript,
      question: '점심은 무엇을 드셨어요?',
      turns: SESSION.turns.map(turn => ({ ...turn, answerText: null, botText: null })),
    });
    await renderDetail();

    await expect.element(page.getByRole('note')).toHaveTextContent(text);
    await expect.element(page.getByRole('listitem', { name: '2번째 대답 기분 걱정' })).toBeVisible();
    expect(page.getByText('국수 먹었어').elements()).toHaveLength(0);
    expect(document.querySelectorAll('[aria-labelledby="companion-transcript"] li')).toHaveLength(0);
  });

  it('위험 알림이 나간 대화·테스트 대화·끊긴 대화를 표시한다', async () => {
    data.session.mockResolvedValue({ ...SESSION, riskAlerted: true, test: true, status: 'LOST' });
    await renderDetail();

    await expect.element(page.getByText('이 대화로 위험 알림을 보냈어요')).toBeVisible();
    await expect.element(page.getByText('테스트', { exact: true })).toBeVisible();
    await expect.element(page.getByText('대화가 중간에 끊겼어요')).toBeVisible();
  });

  it('연결되지 않은 피보호자(403)면 안내만 보이고 다시 불러오기를 두지 않는다', async () => {
    data.session.mockRejectedValue(apiError(403, 'COMPANION_NOT_AUTHORIZED'));
    await renderDetail();

    await expect.element(page.getByRole('alert')).toHaveTextContent('연결된 피보호자의 안부 대화만 볼 수 있습니다.');
    expect(page.getByRole('button', { name: '다시 불러오기' }).elements()).toHaveLength(0);
    await expect.element(page.getByRole('link', { name: /AI 기분 체크/ })).toHaveAttribute('href', '/guardian/emotion');
  });

  it('없는 대화(404)는 찾을 수 없다고 하고 다시 불러오기를 두지 않는다', async () => {
    data.session.mockRejectedValueOnce(apiError(404, 'COMPANION_SESSION_NOT_FOUND'));
    await renderDetail();
    await expect.element(page.getByRole('alert')).toHaveTextContent('대화를 찾을 수 없어요.');
    expect(page.getByRole('button', { name: '다시 불러오기' }).elements()).toHaveLength(0);
  });

  it('다른 오류는 다시 불러올 수 있다', async () => {
    data.session.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(SESSION);
    await renderDetail();
    await expect.element(page.getByText('대화를 불러오지 못했어요.')).toBeVisible();
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect.element(page.getByRole('region', { name: '기분 요약' })).toBeVisible();
  });

  it('주소에 피보호자가 없으면 부르지 않는다', async () => {
    data.search = '';
    await renderDetail();
    await expect.element(page.getByRole('alert')).toHaveTextContent('대화를 찾을 수 없어요.');
    expect(data.session).not.toHaveBeenCalled();
  });

  it('대화 번호가 숫자가 아니면 부르지 않는다', async () => {
    data.params = { sessionId: 'abc' };
    await renderDetail();
    await expect.element(page.getByRole('alert')).toHaveTextContent('대화를 찾을 수 없어요.');
    expect(data.session).not.toHaveBeenCalled();
  });
});
