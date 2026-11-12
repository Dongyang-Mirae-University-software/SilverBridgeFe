// 피보호자 안부 말벗 - 오늘 현황 → 대화 열기 → 글·말로 대답 → 마치기. 실제 Chrome에서 돈다
// 마이크 대신 Web Audio 발진기 스트림을 getUserMedia 결과로 넘겨 녹음·WAV 업로드 흐름을 그대로 탄다
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { IWardCompanionTranscriptConsent } from '@/service/interface/ward/companion';
import { render } from 'vitest-browser-react';

import type { IWardCompanionToday } from '@/service/interface/ward/companion';
import { WardCompanionContent } from './WardCompanionContent';

const api = vi.hoisted(() => ({
  today: vi.fn(),
  open: vi.fn(),
  replyText: vi.fn(),
  replyAudio: vi.fn(),
  finish: vi.fn(),
  openTest: vi.fn(),
  prompt: vi.fn(),
  speak: vi.fn(),
  consent: vi.fn(),
  setConsent: vi.fn(),
}));
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('@/service/api/ward/companion', () => ({
  getWardCompanionToday: api.today,
  openWardCompanionSession: api.open,
  replyWardCompanionText: api.replyText,
  replyWardCompanionAudio: api.replyAudio,
  finishWardCompanionSession: api.finish,
  openWardCompanionTestSession: api.openTest,
  sendWardCompanionTestPrompt: api.prompt,
  getWardCompanionTranscriptConsent: api.consent,
  updateWardCompanionTranscriptConsent: api.setConsent,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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

// 앞면 카메라 대신 캔버스 스트림 - 실제 video·canvas·toBlob(JPEG) 경로를 그대로 탄다
let cameraTracks: MediaStreamTrack[] = [];
function fakeCameraStream() {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#c96';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const stream = canvas.captureStream(10);
  cameraTracks.push(...stream.getTracks());
  // captureStream은 그림이 바뀌어야 프레임을 낸다
  const timer = setInterval(() => {
    context.fillStyle = `hsl(${Date.now() % 360} 50% 50%)`;
    context.fillRect(0, 0, 40, 40);
  }, 50);
  stream.getTracks()[0].addEventListener('ended', () => clearInterval(timer));
  setTimeout(() => clearInterval(timer), 15_000);
  return stream;
}

// 마이크·카메라를 따로 묻는다 - video를 달라는 호출이면 카메라, 아니면 마이크
function mediaDevices({ camera }: { camera: 'allow' | 'deny' }) {
  getUserMedia.mockImplementation(async (constraints: MediaStreamConstraints) => {
    if (constraints.video) {
      if (camera === 'deny') throw new DOMException('denied', 'NotAllowedError');
      return fakeCameraStream();
    }
    return fakeMicStream();
  });
}
const cameraCalls = () => getUserMedia.mock.calls.filter(([constraints]) => (constraints as MediaStreamConstraints).video).length;

async function recordOnce(waitMs = 500) {
  await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
  await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
  await new Promise(resolve => setTimeout(resolve, waitMs));
  await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
}

const TEST_TODAY = { ...OPEN_NOON, testMode: true };
// 이미 동의를 물은 계정(첫 대화 동의 카드가 뜨지 않는다) / 아직 묻지 않은 계정
const CONSENT_ASKED: IWardCompanionTranscriptConsent = { consented: true, consentedAt: '2026-11-01T09:00:00+09:00', retentionDays: 30, notice: [] };
const CONSENT_NEW: IWardCompanionTranscriptConsent = {
  consented: false,
  consentedAt: null,
  retentionDays: 30,
  notice: ['수집 목적: 가족이 안부 대화를 함께 보기 위해', '보유 기간: 30일'],
};
const TURN_ANALYSIS = {
  turnLabel: '걱정',
  turnSource: 'TEXT_FACE',
  face: { usable: true, label: '평온', confidence: 0.8, frameCount: 3, totalFrames: 3, facesFound: 3 },
  riskFlag: false,
  signals: null,
};

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.today.mockResolvedValue(OPEN_NOON);
  api.open.mockResolvedValue(SESSION);
  api.openTest.mockResolvedValue({ ...SESSION, slot: '15:00', question: '오후는 어떻게 보내고 계세요?' });
  api.prompt.mockResolvedValue(undefined);
  api.consent.mockResolvedValue(CONSENT_ASKED);
  window.localStorage.removeItem('sb-companion-consent-asked');
  nav.search = '';
  nav.replace.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
});
afterEach(async () => {
  getUserMedia.mockReset();
  cameraTracks.forEach(track => track.stop());
  cameraTracks = [];
  await toneContext?.close().catch(() => undefined);
  toneContext = null;
  await page.viewport(375, 812);
  document.body.innerHTML = '';
});

describe('오늘 현황 (Chrome)', () => {
  // 피보호자는 시간표를 알 필요가 없다 - 대화 시간 밖이면 안내·시간표 없이 홈으로(2026-11-11)
  it.each([
    ['다음 시간대가 남았을 때', ['DONE', 'MISSED', 'UPCOMING', 'UPCOMING', 'UPCOMING'] as const],
    ['오늘 시간대가 모두 지났을 때', ['DONE', 'DONE', 'MISSED', 'DONE', 'DONE'] as const],
  ])('열 수 있는 시간대가 없으면(%s) 시간표·안내 없이 홈으로 보낸다', async (_label, statuses) => {
    api.today.mockResolvedValue(today(null, [...statuses]));
    await renderCompanion();

    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/ward'));
    expect(document.querySelector('[aria-labelledby="companion-slots-title"]')).toBeNull();
    expect(page.getByText('지금은 안부 대화 시간이 아니에요').elements()).toHaveLength(0);
    expect(page.getByText('다음 안부는', { exact: false }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: '이야기 시작하기' }).elements()).toHaveLength(0);
  });

  it('열 수 있는 시간대가 있으면 머물고, 시간표는 보이지 않는다', async () => {
    await renderCompanion();

    await expect.element(page.getByRole('heading', { name: '낮 12시 안부 인사 시간이에요' })).toBeVisible();
    expect(document.querySelector('[aria-labelledby="companion-slots-title"]')).toBeNull();
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');
  });

  it('창 안이어도 이미 마친 시간대(DONE)면 시작 버튼 없이 홈으로 보낸다', async () => {
    api.today.mockResolvedValue(today('12:00', ['DONE', 'DONE', 'UPCOMING', 'UPCOMING', 'UPCOMING']));
    await renderCompanion();

    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/ward'));
    expect(page.getByRole('button', { name: '이야기 시작하기' }).elements()).toHaveLength(0);
  });

  it('대화를 여는 중에 창이 닫혀도 홈으로 보내지 않는다', async () => {
    let resolveOpen: (value: typeof SESSION) => void = () => undefined;
    api.open.mockReturnValue(new Promise(resolve => { resolveOpen = resolve; }));
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();

    api.today.mockResolvedValue(today(null, ['DONE', 'IN_PROGRESS', 'UPCOMING', 'UPCOMING', 'UPCOMING']));
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await vi.waitFor(() => expect(api.today).toHaveBeenCalledTimes(2));
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');

    resolveOpen(SESSION);
    await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');
    focusManager.setFocused(undefined);
  });

  it('테스트 계정은 대화 시간 밖이어도 홈으로 보내지 않는다(테스트 패널 유지)', async () => {
    api.today.mockResolvedValue({ ...today(null, ['DONE', 'MISSED', 'UPCOMING', 'UPCOMING', 'UPCOMING']), testMode: true });
    await renderCompanion();

    await expect.element(page.getByRole('button', { name: '바로 이야기하기' })).toBeVisible();
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');
  });

  it('오늘 현황을 불러오지 못하면 홈으로 보내지 않고 다시 불러오기를 보인다', async () => {
    api.today.mockRejectedValue(apiError(503, 'SERVICE_UNAVAILABLE'));
    await renderCompanion();

    await expect.element(page.getByRole('button', { name: '다시 불러오기' })).toBeVisible();
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');
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
    expect(page.getByRole('button', { name: '대화 그만하기' }).elements()).toHaveLength(0);
  });

  it('그만하기를 누르면 대화를 마치고 처음 화면으로 돌아갈 수 있다', async () => {
    api.finish.mockResolvedValue({ sessionId: 42, slot: '12:00', endReason: 'USER_STOP', mood: null, turnCount: 0 });
    await openTalk();
    await page.getByRole('button', { name: '대화 그만하기' }).click();

    await expect.element(page.getByRole('heading', { name: '오늘도 이야기 나눠 주셔서 고마워요' })).toBeVisible();
    expect(api.finish).toHaveBeenCalledWith(42);
    expect(page.getByText('다음 안부는', { exact: false }).elements()).toHaveLength(0);
    await page.getByRole('button', { name: '홈으로' }).click();
    await expect.element(page.getByRole('heading', { name: '낮 12시 안부 인사 시간이에요' })).toBeVisible();
  });

  it('대화를 마친 뒤 시간대가 닫혀 있으면 [홈으로]가 홈으로 보낸다', async () => {
    api.finish.mockResolvedValue({ sessionId: 42, slot: '12:00', endReason: 'USER_STOP', mood: null, turnCount: 0 });
    await openTalk();
    await page.getByRole('button', { name: '대화 그만하기' }).click();
    await expect.element(page.getByRole('heading', { name: '오늘도 이야기 나눠 주셔서 고마워요' })).toBeVisible();
    // 마친 화면을 보는 동안에는 시간대가 닫혀도 머문다
    api.today.mockResolvedValue(today(null, ['DONE', 'DONE', 'UPCOMING', 'UPCOMING', 'UPCOMING']));
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');

    await page.getByRole('button', { name: '홈으로' }).click();
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/ward'));
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
    await userEvent.click(page.getByRole('button', { name: '사진 없이 할게요' }));
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
    await userEvent.click(page.getByRole('button', { name: '사진 없이 할게요' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));

    await expect.element(page.getByRole('alert')).toMatchTextContent('지금은 목소리를 알아듣지 못해요. 글로 대답해 주세요.');
    await expect.element(page.getByRole('textbox', { name: '대답 적기' })).toBeVisible();
  });
});

describe('표정 사진 (Chrome)', () => {
  it('처음 대답할 때 안내를 보이고, 허용하면 녹음 동안 찍은 JPEG 여러 장을 audio와 함께 보내고 카메라를 끈다', async () => {
    mediaDevices({ camera: 'allow' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '좋아' });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByText('표정은 기분을 살피는 데만 쓰고 저장하지 않아요.', { exact: false })).toBeVisible();
    expect(getUserMedia).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole('button', { name: '좋아요' }));

    await expect.element(page.getByText('카메라 켜짐')).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 2600));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByText('좋으셨겠어요.')).toBeVisible();

    const [, audio, , frames] = api.replyAudio.mock.calls[0] as [number, Blob, AbortSignal, Blob[]];
    expect(audio.type).toBe('audio/wav');
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames.length).toBeLessThanOrEqual(5);
    frames.forEach(frame => {
      expect(frame.type).toBe('image/jpeg');
      expect(frame.size).toBeLessThanOrEqual(1024 * 1024);
    });
    expect(cameraTracks.length).toBeGreaterThan(0);
    cameraTracks.forEach(track => expect(track.readyState).toBe('ended'));
    expect(page.getByText('카메라 켜짐').elements()).toHaveLength(0);

    // 두 번째 대답은 다시 묻지 않고 카메라를 켠다
    api.replyAudio.mockResolvedValue({ turnNo: 2, reply: '그렇군요.', ended: false, endReason: null, transcript: '응' });
    await recordOnce();
    await expect.element(page.getByText('그렇군요.')).toBeVisible();
    expect(cameraCalls()).toBe(2);
  });

  it('찍은 사진의 짧은 쪽을 640px 안팎으로 줄인다', async () => {
    const { captureJpeg } = await import('@/lib/camera/useFaceFrames');
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = fakeCameraStream();
    await video.play();
    await vi.waitFor(() => expect(video.videoWidth).toBeGreaterThan(0));
    const blob = await captureJpeg(video);
    const bitmap = await createImageBitmap(blob!);
    expect(Math.min(bitmap.width, bitmap.height)).toBe(640);
  });

  it('카메라를 거부하면 한 번 안내하고 목소리만 보낸다, 다음 대답에서는 다시 묻지 않는다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '좋아' });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await userEvent.click(page.getByRole('button', { name: '좋아요' }));
    await expect.element(page.getByText('카메라를 쓸 수 없어 목소리만 보낼게요.')).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByText('좋으셨겠어요.')).toBeVisible();

    const [, , , frames] = api.replyAudio.mock.calls[0] as [number, Blob, AbortSignal, Blob[]];
    expect(frames).toEqual([]);

    await recordOnce();
    await vi.waitFor(() => expect(api.replyAudio).toHaveBeenCalledTimes(2));
    expect(cameraCalls()).toBe(1);
    expect(page.getByText('카메라를 쓸 수 없어 목소리만 보낼게요.').elements()).toHaveLength(0);
  });

  it('사진 없이 하면 카메라를 묻지 않는다', async () => {
    mediaDevices({ camera: 'allow' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '네.', ended: false, endReason: null, transcript: '응' });
    await openTalk();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await userEvent.click(page.getByRole('button', { name: '사진 없이 할게요' }));
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByText('네.', { exact: true })).toBeVisible();
    expect(cameraCalls()).toBe(0);
    expect((api.replyAudio.mock.calls[0] as unknown[])[3]).toEqual([]);
  });

  it('사진 때문에 거절되면(COMPANION_FRAME_INVALID) 사진을 끄고 목소리만 다시 보내게 한다', async () => {
    mediaDevices({ camera: 'allow' });
    api.replyAudio.mockRejectedValueOnce(apiError(400, 'COMPANION_FRAME_INVALID'));
    await openTalk();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await userEvent.click(page.getByRole('button', { name: '좋아요' }));
    await expect.element(page.getByText('카메라 켜짐')).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByRole('alert')).toMatchTextContent('사진을 보내지 못했어요. 이제 목소리만 보낼게요. 다시 말씀해 주세요.');

    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '네.', ended: false, endReason: null, transcript: '응' });
    await recordOnce();
    await expect.element(page.getByText('네.', { exact: true })).toBeVisible();
    expect(cameraCalls()).toBe(1);
  });

  it('녹음을 버리면(그만하기) 카메라도 바로 끈다', async () => {
    mediaDevices({ camera: 'allow' });
    api.finish.mockResolvedValue({ sessionId: 42, slot: '12:00', endReason: 'USER_STOP', mood: null, turnCount: 0 });
    await openTalk();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await userEvent.click(page.getByRole('button', { name: '좋아요' }));
    await expect.element(page.getByText('카메라 켜짐')).toBeVisible();
    await page.getByRole('button', { name: '대화 그만하기' }).click();

    await expect.element(page.getByRole('heading', { name: '오늘도 이야기 나눠 주셔서 고마워요' })).toBeVisible();
    await vi.waitFor(() => cameraTracks.forEach(track => expect(track.readyState).toBe('ended')));
    expect(api.replyAudio).not.toHaveBeenCalled();
  });
});

describe('테스트 계정 (Chrome)', () => {
  it('testMode가 아니면 테스트 칸·결과 칸이 없다', async () => {
    api.replyText.mockResolvedValue({ turnNo: 1, reply: '네.', ended: false, endReason: null, transcript: null });
    await openTalk();
    expect(page.getByText('테스트용').elements()).toHaveLength(0);
    expect(page.getByRole('heading', { name: /판정 결과/ }).elements()).toHaveLength(0);
  });

  it('testMode가 아니면 analysis에 textMood가 와도 말로 본 기분을 보이지 않는다', async () => {
    api.replyText.mockResolvedValue({
      turnNo: 1, reply: '네.', ended: false, endReason: null, transcript: null,
      analysis: { ...TURN_ANALYSIS, textMood: { label: 'WORRY', turnLabel: '슬픔', confidence: 0.82, usable: true, reason: null } },
    });
    await openTalk();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('그냥 그래');
    await page.getByRole('button', { name: '보내기' }).click();
    await expect.element(page.getByText('네.')).toBeVisible();
    expect(page.getByText('말로 본 기분', { exact: false }).elements()).toHaveLength(0);
  });

  it('testMode가 아니면 테스트 푸시 주소로 와도 시작 버튼을 보이지 않는다', async () => {
    nav.search = 'testSlot=15:00';
    await renderCompanion();
    await expect.element(page.getByRole('button', { name: '이야기 시작하기' })).toBeVisible();
    expect(page.getByRole('button', { name: /대화 시작/ }).elements()).toHaveLength(0);
  });

  it('시간대를 골라 바로 시작하고, 턴마다·마치기 뒤 판정 결과를 사람이 읽는 말로 보여 준다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    api.replyText.mockResolvedValue({ turnNo: 1, reply: '그러셨군요.', ended: false, endReason: null, transcript: null, analysis: TURN_ANALYSIS });
    api.finish.mockResolvedValue({
      sessionId: 42, slot: '15:00', endReason: 'USER_STOP', mood: 'WORRY', turnCount: 1,
      analysis: { mood: 'WORRY', turnCount: 1, answeredCount: 1, noResponseCount: 0, riskFlag: false, alertLevel: null, test: true },
    });
    await renderCompanion();

    await expect.element(page.getByRole('heading', { name: '안부 말벗 테스트' })).toBeVisible();
    await page.getByRole('button', { name: '오후 3시' }).click();
    await expect.element(page.getByRole('button', { name: '오후 3시' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '바로 이야기하기' }).click();

    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    expect(api.openTest).toHaveBeenCalledWith('15:00');
    expect(api.open).not.toHaveBeenCalled();
    await expect.element(page.getByText('대답하면 판정 결과가 여기에 나와요.')).toBeVisible();

    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('좀 걱정돼');
    await page.getByRole('button', { name: '보내기' }).click();
    await expect.element(page.getByText(
      '1번째 대답 · 턴 기분: 걱정 · 근거: 말+표정 · 표정: 평온(사진 3장 중 얼굴 3, 확신 80%) · 위험: 없음',
    )).toBeVisible();

    await page.getByRole('button', { name: '대화 그만하기' }).click();
    await expect.element(page.getByText(
      '대화 마침 · 대화 기분: 걱정 · 턴 수: 1(대답 1·무응답 0) · 위험: 없음 · 알림 단계: 없음',
    )).toBeVisible();
  });

  async function sendTestTurn(textMood: unknown) {
    api.today.mockResolvedValue(TEST_TODAY);
    api.replyText.mockResolvedValue({ turnNo: 1, reply: '그러셨군요.', ended: false, endReason: null, transcript: null, analysis: { ...TURN_ANALYSIS, textMood } });
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('좀 걱정돼');
    await page.getByRole('button', { name: '보내기' }).click();
    await expect.element(page.getByText('1번째 대답', { exact: false })).toBeVisible();
  }

  it('턴 결과에 말로 본 기분(확신)을 표정 앞에 보여 준다', async () => {
    await sendTestTurn({ label: 'WORRY', turnLabel: '슬픔', confidence: 0.82, usable: true, reason: null });
    await expect.element(page.getByText(
      '1번째 대답 · 턴 기분: 걱정 · 근거: 말+표정 · 말로 본 기분: 슬픔(확신 82%) · 표정: 평온(사진 3장 중 얼굴 3, 확신 80%) · 위험: 없음',
    )).toBeVisible();
  });

  it('말을 판단에 쓰지 못했으면(usable=false) 판단 안 함과 이유를 보여 준다', async () => {
    await sendTestTurn({ label: null, turnLabel: null, confidence: null, usable: false, reason: 'UNAVAILABLE' });
    await expect.element(page.getByText('말로 본 기분: 판단 안 함(UNAVAILABLE)', { exact: false })).toBeVisible();
  });

  it('textMood가 null이면 말로 본 기분 칸이 없다', async () => {
    await sendTestTurn(null);
    await expect.element(page.getByText('1번째 대답 · 턴 기분: 걱정 · 근거: 말+표정 · 표정:', { exact: false })).toBeVisible();
    expect(page.getByText('말로 본 기분', { exact: false }).elements()).toHaveLength(0);
  });

  it('서버가 대화를 끝내면 저장된 결과를 다시 받아 대화 판정을 붙인다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    api.replyText.mockResolvedValue({ turnNo: 8, reply: '고마워요.', ended: true, endReason: 'MAX_TURNS', transcript: null, analysis: { ...TURN_ANALYSIS, riskFlag: true } });
    api.finish.mockResolvedValue({
      sessionId: 42, slot: '15:00', endReason: 'MAX_TURNS', mood: null, turnCount: 8,
      analysis: { mood: null, turnCount: 8, answeredCount: 8, noResponseCount: 0, riskFlag: true, alertLevel: 'URGENT', test: true },
    });
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
    await page.getByRole('textbox', { name: '대답 적기' }).fill('힘들어');
    await page.getByRole('button', { name: '보내기' }).click();

    await expect.element(page.getByText('위험: 있음', { exact: false }).first()).toBeVisible();
    await expect.element(page.getByText('대화 기분: 판단 불가', { exact: false })).toBeVisible();
    await expect.element(page.getByText('알림 단계: 긴급', { exact: false })).toBeVisible();
  });

  it('안부 알림 보내기는 고른 시간대로 test/prompt를 부르고 안내한다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    await renderCompanion();
    await page.getByRole('button', { name: '오후 6시' }).click();
    await page.getByRole('button', { name: '안부 알림 받아 보기' }).click();

    await expect.element(page.getByText('오후 6시 안부 알림을 보냈어요. 잠시 뒤 알림이 와요.')).toBeVisible();
    expect(api.prompt).toHaveBeenCalledWith('18:00');
  });

  it('테스트 계정이 아니라고 거절되면(403 COMPANION_TEST_NOT_ALLOWED) 안내한다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    api.openTest.mockRejectedValue(apiError(403, 'COMPANION_TEST_NOT_ALLOWED'));
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await expect.element(page.getByText('테스트 계정만 쓸 수 있습니다.')).toBeVisible();
  });

  it('테스트 푸시로 들어오면(?testSlot=15:00) 그 시간대 대화 시작 버튼을 보이고, 누르면 테스트로 시작한다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    nav.search = 'testSlot=15:00';
    await renderCompanion();

    await expect.element(page.getByText('오후 3시 안부 알림으로 오셨어요')).toBeVisible();
    await page.getByRole('button', { name: '오후 3시 대화 시작' }).click();

    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    expect(api.openTest).toHaveBeenCalledWith('15:00');
    expect(nav.replace).toHaveBeenCalledWith('/ward/companion');
  });

  it('정해진 시간대가 아니면(?testSlot=16:00) 테스트 시작 버튼을 만들지 않는다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    nav.search = 'testSlot=16:00';
    await renderCompanion();
    await expect.element(page.getByRole('button', { name: '바로 이야기하기' })).toBeVisible();
    expect(page.getByText('안부 알림으로 오셨어요', { exact: false }).elements()).toHaveLength(0);
  });
});

describe('새 화면 배치 (Chrome)', () => {
  function turnReply(turnNo: number) {
    return { turnNo, reply: '그러셨군요. 또 무엇을 하셨어요?', ended: false, endReason: null, transcript: null, analysis: TURN_ANALYSIS };
  }

  async function startTestTalk() {
    api.today.mockResolvedValue(TEST_TODAY);
    let turn = 0;
    api.replyText.mockImplementation(async () => turnReply(++turn));
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    await page.getByRole('button', { name: '글로 대답하기' }).click();
  }

  async function answer(text: string) {
    await page.getByRole('textbox', { name: '대답 적기' }).fill(text);
    await page.getByRole('button', { name: '보내기' }).click();
  }

  it('테스트 시작 화면: 설명 문장 없이 말벗 인사 말풍선(두 문장)·시간대 5칸·두 버튼', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    await renderCompanion();

    await expect.element(page.getByText('안녕하세요.', { exact: true })).toBeVisible();
    await expect.element(page.getByText('오전 9시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();
    expect(page.getByText('시간대를 고르고 바로 시작하거나', { exact: false }).elements()).toHaveLength(0);
    expect(page.getByRole('group', { name: '안부 시간대' }).getByRole('button').elements()).toHaveLength(5);
    await page.getByRole('button', { name: '오후 6시' }).click();
    await expect.element(page.getByText('오후 6시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '안부 알림 받아 보기' })).toBeVisible();
  });

  it('말벗 문장은 문장 끝(?·.) 뒤에서 줄을 나눠 두 줄로 보인다', async () => {
    await startTestTalk();
    await answer('산책했어');

    const first = page.getByText('그러셨군요.', { exact: true }).element() as HTMLElement;
    const second = page.getByText('또 무엇을 하셨어요?', { exact: true }).element() as HTMLElement;
    expect(second.getBoundingClientRect().top).toBeGreaterThan(first.getBoundingClientRect().top);
  });

  it('폰(390×844): 머리에 진행 점, 아래 줄에 글로 대답하기 | 대화 그만하기, 판정은 접힌 한 줄', async () => {
    await page.viewport(390, 844);
    await startTestTalk();
    await answer('좋아');

    const answerBar = page.getByRole('region', { name: '대답하기' });
    await expect.element(answerBar.getByRole('button', { name: '대화 그만하기' })).toBeVisible();
    expect(page.getByRole('complementary').elements()).toHaveLength(0);
    expect(document.querySelectorAll('[class*="progressDots"] i')).toHaveLength(8);
    await expect.element(page.getByText('1번째 대답', { exact: false })).toBeVisible();
    const details = document.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('태블릿(1280×800): 오른쪽 칸에 카메라·판정 결과·대화 그만하기, 판정은 방금 대답 + 지난 대답 7줄(8개 누적)', async () => {
    await page.viewport(1280, 800);
    await startTestTalk();
    for (let i = 1; i <= 8; i += 1) {
      await answer(`대답 ${i}`);
      await expect.element(page.getByText(`${i}번째 대답 · 턴 기분`, { exact: false }).first()).toBeInTheDocument();
    }

    const side = page.getByRole('complementary', { name: '카메라와 판정 결과' });
    await expect.element(side.getByRole('button', { name: '대화 그만하기' })).toBeVisible();
    await expect.element(side.getByText('말로 대답하는 동안 여기에 얼굴이 보여요')).toBeVisible();
    expect(page.getByRole('region', { name: '대답하기' }).getByRole('button', { name: '대화 그만하기' }).elements()).toHaveLength(0);
    await expect.element(side.getByText('방금 대답')).toBeVisible();
    await expect.element(side.getByText('8번째 대답 · 턴 기분', { exact: false })).toBeVisible();
    const earlier = side.getByRole('list', { name: '지난 대답 판정' }).getByRole('listitem').elements();
    expect(earlier).toHaveLength(7);
    expect(earlier[0].textContent).toContain('7번째 대답');
    expect(earlier[6].textContent).toContain('1번째 대답');
    // 지난 대답은 한 줄로 줄인다
    expect(getComputedStyle(earlier[0]).whiteSpace).toBe('nowrap');
  });

  it('대화 그만하기는 위치만 옮겼고 마치기(USER_STOP)를 부른다', async () => {
    await page.viewport(1280, 800);
    api.finish.mockResolvedValue({ sessionId: 42, slot: '15:00', endReason: 'USER_STOP', mood: null, turnCount: 0 });
    await startTestTalk();
    await page.getByRole('complementary').getByRole('button', { name: '대화 그만하기' }).click();
    await expect.element(page.getByRole('heading', { name: '오늘도 이야기 나눠 주셔서 고마워요' })).toBeVisible();
    expect(api.finish).toHaveBeenCalledWith(42);
  });
});

describe('대화 내용 공유 동의 (Chrome)', () => {
  it('처음 대화를 시작하면 먼저 묻고, 보여 줄게요를 고르면 동의를 저장한 뒤 시작한다', async () => {
    api.consent.mockResolvedValue(CONSENT_NEW);
    api.setConsent.mockResolvedValue({ ...CONSENT_NEW, consented: true, consentedAt: '2026-11-12T10:00:00+09:00' });
    await renderCompanion();
    await expect.element(page.getByText('대답한 말과 목소리, 얼굴 사진은 저장하지 않아요.')).toBeVisible();

    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await expect.element(page.getByRole('heading', { name: '안부 대화 내용을 가족에게 보여 줄까요?' })).toBeVisible();
    await expect.element(page.getByText('수집 목적: 가족이 안부 대화를 함께 보기 위해')).toBeVisible();
    expect(api.open).not.toHaveBeenCalled();

    await page.getByRole('button', { name: '보여 줄게요' }).click();
    await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
    expect(api.setConsent).toHaveBeenCalledWith(true);
    expect(api.open).toHaveBeenCalledTimes(1);
  });

  it('보여 주지 않을게요를 고르면 저장 없이 시작하고, 다시 들어와도 묻지 않는다', async () => {
    api.consent.mockResolvedValue(CONSENT_NEW);
    api.today.mockResolvedValue(TEST_TODAY);
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await page.getByRole('button', { name: '보여 주지 않을게요' }).click();

    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    expect(api.setConsent).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('sb-companion-consent-asked')).toBe('1');
    document.body.innerHTML = '';

    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    expect(page.getByRole('heading', { name: '안부 대화 내용을 가족에게 보여 줄까요?' }).elements()).toHaveLength(0);
  });

  it('동의 저장에 실패하면 카드에 남아 다시 누르게 한다', async () => {
    api.consent.mockResolvedValue(CONSENT_NEW);
    api.setConsent.mockRejectedValueOnce(apiError(503, 'SERVICE_UNAVAILABLE'));
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await page.getByRole('button', { name: '보여 줄게요' }).click();

    await expect.element(page.getByText('저장하지 못했어요. 다시 눌러 주세요.')).toBeVisible();
    expect(api.open).not.toHaveBeenCalled();
  });

  it('이미 동의한 계정은 묻지 않고, 보관 안내 문구를 보인다', async () => {
    await renderCompanion();
    await expect.element(page.getByText('대답한 말은 가족이 볼 수 있게 30일 동안 보관해요.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
    expect(api.setConsent).not.toHaveBeenCalled();
  });

  it('동의 상태를 못 받으면 묻지 않고 대화를 막지 않는다', async () => {
    api.consent.mockRejectedValue(apiError(503, 'SERVICE_UNAVAILABLE'));
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
  });
});
