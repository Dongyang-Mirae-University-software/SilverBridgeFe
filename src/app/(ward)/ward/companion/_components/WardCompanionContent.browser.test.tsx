// 피보호자 안부 말벗 - 오늘 현황 → 대화 열기 → 글·말로 대답 → 마치기. 실제 Chrome에서 돈다
// 마이크 대신 Web Audio 발진기 스트림을 getUserMedia 결과로 넘겨 녹음·WAV 업로드 흐름을 그대로 탄다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { IWardCompanionToday } from '@/service/interface/ward/companion';
import { WardCompanionContent } from './WardCompanionContent';

const api = vi.hoisted(() => ({
  today: vi.fn(),
  open: vi.fn(),
  replyText: vi.fn(),
  replyAudio: vi.fn(),
  finish: vi.fn(),
  speak: vi.fn(),
}));

vi.mock('@/service/api/ward/companion', () => ({
  getWardCompanionToday: api.today,
  openWardCompanionSession: api.open,
  replyWardCompanionText: api.replyText,
  replyWardCompanionAudio: api.replyAudio,
  finishWardCompanionSession: api.finish,
}));
vi.mock('@/lib/audio/speech', () => ({ canSpeak: () => true, speak: api.speak, stopSpeaking: vi.fn() }));

function today(currentSlot: string | null, statuses: IWardCompanionToday['slots'][number]['status'][]): IWardCompanionToday {
  const times = ['09:00', '12:00', '15:00', '18:00', '21:00'];
  return { date: '2026-11-05', currentSlot, slots: times.map((slot, index) => ({ slot, status: statuses[index], mood: null })) };
}

const OPEN_NOON = today('12:00', ['DONE', 'AVAILABLE', 'UPCOMING', 'UPCOMING', 'UPCOMING']);
const SESSION = { sessionId: 42, slot: '12:00', question: '점심은 무엇을 드셨어요?', maxTurns: 8, resumed: false };

function apiError(status: number, code: string) {
  return new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: { success: false, code },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

async function renderCompanion() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WardCompanionContent />
    </QueryClientProvider>,
  );
}

async function openTalk() {
  await renderCompanion();
  await page.getByRole('button', { name: '이야기 시작하기' }).click();
  await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
}

let toneContext: AudioContext | null = null;
function fakeMicStream() {
  toneContext = new AudioContext();
  const oscillator = toneContext.createOscillator();
  const destination = toneContext.createMediaStreamDestination();
  oscillator.connect(destination);
  oscillator.start();
  return destination.stream;
}
const getUserMedia = vi.fn();

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.today.mockResolvedValue(OPEN_NOON);
  api.open.mockResolvedValue(SESSION);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
});
afterEach(async () => {
  getUserMedia.mockReset();
  await toneContext?.close().catch(() => undefined);
  toneContext = null;
  document.body.innerHTML = '';
});

describe('오늘 현황 (Chrome)', () => {
  it('열 수 있는 시간대가 없으면 시작 버튼 없이 다음 시간대를 알려 준다', async () => {
    api.today.mockResolvedValue(today(null, ['DONE', 'MISSED', 'UPCOMING', 'UPCOMING', 'UPCOMING']));
    await renderCompanion();

    await expect.element(page.getByRole('heading', { name: '지금은 안부 대화 시간이 아니에요' })).toBeVisible();
    await expect.element(page.getByText('다음 안부는 오후 3시예요.', { exact: false })).toBeVisible();
    expect(page.getByRole('button', { name: '이야기 시작하기' }).elements()).toHaveLength(0);
    const slots = [...document.querySelectorAll('[aria-labelledby="companion-slots-title"] li')].map(li => li.textContent);
    expect(slots).toEqual(['오전 9시마쳤어요', '낮 12시지나갔어요', '오후 3시예정', '오후 6시예정', '오후 9시예정']);
  });

  it('오늘 시간대가 모두 지나면 내일 첫 시간대를 알려 준다', async () => {
    api.today.mockResolvedValue(today(null, ['DONE', 'DONE', 'MISSED', 'DONE', 'DONE']));
    await renderCompanion();

    await expect.element(page.getByRole('heading', { name: '오늘 안부 대화는 모두 끝났어요' })).toBeVisible();
    await expect.element(page.getByText('내일 오전 9시에 다시 만나요.')).toBeVisible();
  });

  it('하던 대화가 있으면 이어서 이야기하기로 연다', async () => {
    api.today.mockResolvedValue(today('12:00', ['DONE', 'IN_PROGRESS', 'UPCOMING', 'UPCOMING', 'UPCOMING']));
    api.open.mockResolvedValue({ ...SESSION, resumed: true });
    await renderCompanion();

    await page.getByRole('button', { name: '이어서 이야기하기' }).click();

    await expect.element(page.getByText('하던 이야기를 이어서 해요.')).toBeVisible();
  });

  it('여는 사이 시간이 지나면(409 COMPANION_NOT_IN_WINDOW) 안내하고 현황을 다시 받는다', async () => {
    api.open.mockRejectedValue(apiError(409, 'COMPANION_NOT_IN_WINDOW'));
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();

    await expect.element(page.getByRole('alert')).toMatchTextContent('지금은 안부 대화 시간이 아니에요.');
    await vi.waitFor(() => expect(api.today).toHaveBeenCalledTimes(2));
  });

  it('말벗이 꺼져 있으면(503) 잠시 후 다시 하라고 안내한다', async () => {
    api.open.mockRejectedValue(apiError(503, 'COMPANION_UNAVAILABLE'));
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();

    await expect.element(page.getByRole('alert')).toMatchTextContent('지금은 말벗과 이야기할 수 없어요. 잠시 후 다시 해 주세요.');
  });
});

describe('대화 (Chrome)', () => {
  it('질문을 읽어 주고, 글로 대답하면 말벗 응답을 보여 주고 읽어 준다', async () => {
    api.replyText.mockResolvedValue({ turnNo: 1, reply: '국수 맛있으셨겠어요.', ended: false, endReason: null, transcript: null });
    await openTalk();
    expect(api.speak).toHaveBeenLastCalledWith('점심은 무엇을 드셨어요?');
    await expect.element(page.getByText('8번 중 1번째 대답')).toBeVisible();

    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('  국수 먹었어  ');
    await page.getByRole('button', { name: '보내기' }).click();

    await expect.element(page.getByText('국수 맛있으셨겠어요.')).toBeVisible();
    expect(api.replyText).toHaveBeenCalledWith(42, '국수 먹었어');
    expect(api.speak).toHaveBeenLastCalledWith('국수 맛있으셨겠어요.');
    await expect.element(page.getByText('국수 먹었어', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('textbox', { name: '대답 적기' })).toHaveValue('');
    await expect.element(page.getByText('8번 중 2번째 대답')).toBeVisible();
  });

  it('보내기에 실패하면 적은 대답을 지우지 않는다', async () => {
    api.replyText.mockRejectedValue(apiError(504, 'COMPANION_TIMEOUT'));
    await openTalk();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('국수 먹었어');
    await page.getByRole('button', { name: '보내기' }).click();

    await expect.element(page.getByRole('alert')).toMatchTextContent('말벗 대답이 늦어요. 다시 보내 주세요.');
    await expect.element(page.getByRole('textbox', { name: '대답 적기' })).toHaveValue('국수 먹었어');
  });

  it('서버가 대화를 끝내면(ended) 마무리 인사를 보이고 마치기를 따로 부르지 않는다', async () => {
    api.replyText.mockResolvedValue({ turnNo: 8, reply: '오늘 이야기 고마워요.', ended: true, endReason: 'MAX_TURNS', transcript: null });
    await openTalk();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('응');
    await page.getByRole('button', { name: '보내기' }).click();

    await expect.element(page.getByRole('heading', { name: '오늘도 이야기 나눠 주셔서 고마워요' })).toBeVisible();
    expect(api.finish).not.toHaveBeenCalled();
    expect(page.getByRole('button', { name: '그만하기' }).elements()).toHaveLength(0);
  });

  it('그만하기를 누르면 대화를 마치고 처음 화면으로 돌아갈 수 있다', async () => {
    api.finish.mockResolvedValue({ sessionId: 42, slot: '12:00', endReason: 'USER_STOP', mood: null, turnCount: 0 });
    await openTalk();
    await page.getByRole('button', { name: '그만하기' }).click();

    await expect.element(page.getByRole('heading', { name: '오늘도 이야기 나눠 주셔서 고마워요' })).toBeVisible();
    expect(api.finish).toHaveBeenCalledWith(42);
    await page.getByRole('button', { name: '처음 화면으로' }).click();
    await expect.element(page.getByRole('heading', { name: '낮 12시 안부 인사 시간이에요' })).toBeVisible();
  });

  it('대화가 끊기면(409 COMPANION_SESSION_LOST) 대화를 닫고 오늘 현황으로 돌아간다', async () => {
    api.replyText.mockRejectedValue(apiError(409, 'COMPANION_SESSION_LOST'));
    await openTalk();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('응');
    await page.getByRole('button', { name: '보내기' }).click();

    await expect.element(page.getByRole('alert')).toMatchTextContent('대화가 끊겼어요. 다음 시간에 다시 이야기해요.');
    expect(page.getByText('점심은 무엇을 드셨어요?').elements()).toHaveLength(0);
  });

  it('말로 대답하면 WAV를 올리고 받아 적은 글을 "이렇게 들었어요"로 보여 준다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '점심은 국수 먹었어' });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));

    await expect.element(page.getByText('좋으셨겠어요.')).toBeVisible();
    await expect.element(page.getByText('이렇게 들었어요')).toBeVisible();
    await expect.element(page.getByText('점심은 국수 먹었어')).toBeVisible();
    const [sessionId, blob] = api.replyAudio.mock.calls[0] as [number, Blob];
    expect(sessionId).toBe(42);
    expect(blob.type).toBe('audio/wav');
  });

  it('음성을 못 알아들으면(503 COMPANION_STT_UNAVAILABLE) 글로 대답하는 칸으로 바꾼다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.replyAudio.mockRejectedValue(apiError(503, 'COMPANION_STT_UNAVAILABLE'));
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));

    await expect.element(page.getByRole('alert')).toMatchTextContent('지금은 목소리를 알아듣지 못해요. 글로 대답해 주세요.');
    await expect.element(page.getByRole('textbox', { name: '대답 적기' })).toBeVisible();
  });
});
