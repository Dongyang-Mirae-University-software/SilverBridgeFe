// 보호자 AI 기분 체크 - 오늘 안부 대화 API 값만 보이고, null은 "확인할 수 없어요"로 둔다(0·정상으로 채우지 않음). 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { ICompanionToday } from '@/service/interface/guardian/companion';
import { clearSelectedWardId } from '@/store/selectedWardStore';
import { formatSlotTime } from '@/utils/format/slotTime';
import { GuardianEmotionContent } from './GuardianEmotionContent';

const data = vi.hoisted(() => ({
  connections: (async () => ({ data: [] })) as () => Promise<unknown>,
  today: (async () => null) as (wardId: string) => Promise<unknown>,
}));

vi.mock('@/service/query/guardian', () => ({
  guardianConnectionsQueryOptions: queryOptions({ queryKey: ['test-connections'], queryFn: () => data.connections() }),
  wardCompanionTodayQueryOptions: (wardId: string) =>
    queryOptions({ queryKey: ['test-companion', wardId], queryFn: () => data.today(wardId) }),
}));

const ward = (partnerUserId: string, partnerName: string) => ({
  id: 1,
  partnerUserId,
  partnerName,
  partnerProfileImage: null,
  status: 'ACTIVE',
  connectedAt: '2026-11-01T00:00:00+09:00',
  createdAt: '2026-11-01T00:00:00+09:00',
});

const SLOTS = ['09:00', '12:00', '15:00', '18:00', '21:00'];

// 지금 실서버가 주는 빈 상태: 시간대 5개 + current null
const EMPTY_TODAY: ICompanionToday = {
  date: '2026-11-04',
  current: null,
  answeredCount: 0,
  slotCount: 5,
  nextSlot: '15:00',
  slots: SLOTS.map(slot => ({ slot, question: null, status: 'UPCOMING', mood: null })),
  attention: null,
};

const SAMPLE_TODAY: ICompanionToday = {
  date: '2026-11-04',
  current: { slot: '12:00', mood: 'JOY', endedAt: '2026-11-04T12:14:03+09:00', summary: null },
  answeredCount: 2,
  slotCount: 5,
  nextSlot: '15:00',
  slots: [
    { slot: '09:00', question: '지난밤에는 잠을 어떻게 주무셨어요?', status: 'DONE', mood: null },
    { slot: '12:00', question: '점심은 무엇을 드셨어요?', status: 'DONE', mood: 'JOY' },
    { slot: '15:00', question: '오늘 오후에는 무엇을 하며 지내셨어요?', status: 'AVAILABLE', mood: null },
    { slot: '18:00', question: '오늘 누구와 이야기를 나누셨어요?', status: 'UPCOMING', mood: null },
    { slot: '21:00', question: null, status: 'MISSED', mood: null },
  ],
  attention: { mood: 'WORRY', days: 3 },
};

function renderEmotion() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuardianEmotionContent />
    </QueryClientProvider>,
  );
}

function slotRows() {
  return [...document.querySelectorAll('li')].map(row => row.textContent);
}

beforeEach(() => {
  clearSelectedWardId();
  data.connections = async () => ({ data: [ward('w1', '김영희')] });
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('AI 기분 체크 (Chrome)', () => {
  it('대화 기록이 없으면 지금 기분을 "확인할 수 없어요"로 보이고 5개 시간대를 예정으로 보인다', async () => {
    data.today = async () => EMPTY_TODAY;
    await renderEmotion();

    await expect.element(page.getByText('지금 기분은 확인할 수 없어요')).toBeVisible();
    await expect.element(page.getByText('오늘 5번 중 0번 대화했어요 · 다음 안부는 오후 3시')).toBeVisible();
    expect(slotRows()).toEqual(['오전 9시예정', '낮 12시예정', '오후 3시예정', '오후 6시예정', '오후 9시예정']);
    expect(page.getByText('확인할 일').elements()).toHaveLength(0);
  });

  it('기분·질문·상태를 응답 그대로 보이고, 판단할 수 없는 기분은 "확인할 수 없어요"로 보인다', async () => {
    data.today = async () => SAMPLE_TODAY;
    await renderEmotion();

    await expect.element(page.getByText('최근 안부 · 낮 12시')).toBeVisible();
    await expect.element(page.getByRole('region', { name: '지금 기분' })).toMatchTextContent('김영희는 지금 기쁨 상태예요');
    expect(slotRows()).toEqual([
      '오전 9시“지난밤에는 잠을 어떻게 주무셨어요?”확인할 수 없어요',
      '낮 12시“점심은 무엇을 드셨어요?”기쁨',
      '오후 3시“오늘 오후에는 무엇을 하며 지내셨어요?”지금 대화 가능',
      '오후 6시“오늘 누구와 이야기를 나누셨어요?”예정',
      // question이 null이면 질문 줄을 숨긴다
      '오후 9시지나감',
    ]);
  });

  it('걱정·우울이 이어지면 병명 없이 관찰한 사실만 알린다', async () => {
    data.today = async () => SAMPLE_TODAY;
    await renderEmotion();

    await expect
      .element(page.getByRole('note', { name: '확인할 일' }))
      .toMatchTextContent('걱정스러운 기분이 3일째 이어지고 있어요. 안부 전화를 드려 보세요.');
  });

  it('연결되지 않은 피보호자(403 COMPANION_NOT_AUTHORIZED)면 안내만 보이고 다시 불러오기를 두지 않는다', async () => {
    data.today = async () => {
      throw new AxiosError('forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { success: false, code: 'COMPANION_NOT_AUTHORIZED' },
      });
    };
    await renderEmotion();

    await expect.element(page.getByRole('alert')).toMatchTextContent('연결된 피보호자의 안부 대화만 볼 수 있습니다.');
    expect(page.getByRole('button', { name: '다시 불러오기' }).elements()).toHaveLength(0);
  });

  it('다른 오류면 실패 안내와 다시 불러오기를 보인다', async () => {
    let fail = true;
    data.today = async () => {
      if (fail) throw new Error('server down');
      return EMPTY_TODAY;
    };
    await renderEmotion();

    await expect.element(page.getByRole('alert')).toMatchTextContent('안부 대화를 불러오지 못했어요.');
    fail = false;
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect.element(page.getByText('지금 기분은 확인할 수 없어요')).toBeVisible();
  });

  it('피보호자가 여럿이면 고른 사람의 대화를 불러온다', async () => {
    data.connections = async () => ({ data: [ward('w1', '김영희'), ward('w2', '박민철')] });
    const requested: string[] = [];
    data.today = async wardId => {
      requested.push(wardId);
      return wardId === 'w2' ? SAMPLE_TODAY : EMPTY_TODAY;
    };
    await renderEmotion();

    await expect.element(page.getByText('지금 기분은 확인할 수 없어요')).toBeVisible();
    await page.getByRole('tab', { name: /박민철/ }).click();
    await expect.element(page.getByRole('region', { name: '지금 기분' })).toMatchTextContent('박민철은 지금 기쁨 상태예요');
    expect(requested).toEqual(['w1', 'w2']);
  });

  it('연결된 피보호자가 없으면 안내를 보인다', async () => {
    data.connections = async () => ({ data: [] });
    await renderEmotion();

    await expect.element(page.getByText('연결된 피보호자가 없습니다.')).toBeVisible();
  });
});

describe('시간대 표시', () => {
  it.each([
    ['09:00', '오전 9시'],
    ['12:00', '낮 12시'],
    ['18:00', '오후 6시'],
    ['21:30', '오후 9시 30분'],
    ['00:00', '오전 12시'],
    ['아침', '아침'],
  ])('%s → %s', (slot, label) => {
    expect(formatSlotTime(slot)).toBe(label);
  });
});
