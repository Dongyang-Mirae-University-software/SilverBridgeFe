// 피보호자 안부 말벗 - 오늘 현황 → 대화 열기 → 목소리로 대답 → 서버가 끝내면 마침 카드. 실제 Chrome에서 돈다 (글 대답·그만하기·판정 결과 칸은 2026-11-23 삭제)
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
  replyAudio: vi.fn(),
  openTest: vi.fn(),
  prompt: vi.fn(),
  speak: vi.fn(),
  consent: vi.fn(),
  setConsent: vi.fn(),
  audio: vi.fn(),
}));
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('@/service/api/ward/companion', () => ({
  getWardCompanionToday: api.today,
  openWardCompanionSession: api.open,
  replyWardCompanionAudio: api.replyAudio,
  openWardCompanionTestSession: api.openTest,
  sendWardCompanionTestPrompt: api.prompt,
  getWardCompanionTranscriptConsent: api.consent,
  updateWardCompanionTranscriptConsent: api.setConsent,
  fetchWardCompanionAudio: api.audio,
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

async function renderCompanion(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
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
// 마침 제목은 "주셔서" 뒤에서 일부러 줄을 나눈다(<br>)
const END_TITLE = /오늘도 이야기 나눠 주셔서\s*고마워요/;

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.today.mockResolvedValue(OPEN_NOON);
  api.open.mockResolvedValue(SESSION);
  api.openTest.mockResolvedValue({ ...SESSION, slot: '15:00', question: '오후는 어떻게 보내고 계세요?' });
  api.prompt.mockResolvedValue(undefined);
  api.consent.mockResolvedValue(CONSENT_ASKED);
  api.audio.mockRejectedValue(new Error('audio 없음'));
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
  // 서버가 ended 를 주면 마침 카드가 뜬다 - 대화는 목소리 대답으로만 이어진다
  async function endByVoice() {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 8, reply: '오늘 이야기 고마워요.', ended: true, endReason: 'MAX_TURNS', transcript: '응' });
    await openTalk();
    await recordOnce();
    await expect.element(page.getByRole('heading', { name: END_TITLE })).toBeVisible();
  }

  it('질문을 읽어 주고, 목소리로 대답하면 말벗 응답을 보여 주고 읽어 준다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '국수 맛있으셨겠어요.', ended: false, endReason: null, transcript: '국수 먹었어' });
    await openTalk();
    expect(api.speak).toHaveBeenLastCalledWith('점심은 무엇을 드셨어요?');
    await expect.element(page.getByText('8번 중 1번째 대답')).toBeVisible();

    await recordOnce();

    await expect.element(page.getByText('국수 맛있으셨겠어요.')).toBeVisible();
    expect(api.speak).toHaveBeenLastCalledWith('국수 맛있으셨겠어요.');
    await expect.element(page.getByText('8번 중 2번째 대답')).toBeVisible();
  });

  it('보내기에 실패하면 안내를 보이고 말로 대답하기 버튼이 그대로 있어 다시 말할 수 있다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockRejectedValue(apiError(504, 'COMPANION_TIMEOUT'));
    await openTalk();
    await recordOnce();

    await expect.element(page.getByRole('alert')).toMatchTextContent('말벗 대답이 늦어요. 다시 보내 주세요.');
    await expect.element(page.getByRole('button', { name: '말로 대답하기' })).toBeVisible();
  });

  it('서버가 대화를 끝내면(ended) 마무리 인사 카드를 보이고 대답 버튼은 사라진다', async () => {
    await endByVoice();
    expect(page.getByRole('button', { name: '말로 대답하기' }).elements()).toHaveLength(0);
  });

  it('마침 카드의 [홈으로]는 시간대가 아직 열려 있으면 처음 화면으로 돌아간다', async () => {
    await endByVoice();
    expect(page.getByText('다음 안부는', { exact: false }).elements()).toHaveLength(0);
    await page.getByRole('button', { name: '홈으로' }).click();
    await expect.element(page.getByRole('heading', { name: '낮 12시 안부 인사 시간이에요' })).toBeVisible();
  });

  it('대화를 마친 뒤 시간대가 닫혀 있으면 [홈으로]가 홈으로 보낸다', async () => {
    await endByVoice();
    // 마친 화면을 보는 동안에는 시간대가 닫혀도 머문다
    api.today.mockResolvedValue(today(null, ['DONE', 'DONE', 'UPCOMING', 'UPCOMING', 'UPCOMING']));
    expect(nav.replace).not.toHaveBeenCalledWith('/ward');

    await page.getByRole('button', { name: '홈으로' }).click();
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/ward'));
  });

  it('대화가 끊기면(409 COMPANION_SESSION_LOST) 대화를 닫고 오늘 현황으로 돌아간다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockRejectedValue(apiError(409, 'COMPANION_SESSION_LOST'));
    await openTalk();
    await recordOnce();

    await expect.element(page.getByRole('alert')).toMatchTextContent('대화가 끊겼어요. 다음 시간에 다시 이야기해요.');
    expect(page.getByText('점심은 무엇을 드셨어요?').elements()).toHaveLength(0);
  });

  it('말로 대답하면 WAV를 올리고 받아 적은 글을 "이렇게 들었어요"로 보여 준다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '점심은 국수 먹었어' });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    // 녹음 중 버튼 글자는 AI 의료 챗봇처럼 "듣고 있어요"(초 숫자 없음, "다 했어요"는 화면 읽기 이름에만) - 2026-11-23
    const recordingButton = page.getByRole('button', { name: /다 했어요/ }).element();
    expect(recordingButton.textContent).toBe('듣고 있어요');
    expect(document.body.textContent).not.toContain('말씀을 마치면'); // 녹음 중 안내 줄 없음(2026-11-23)
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));

    await expect.element(page.getByText('좋으셨겠어요.')).toBeVisible();
    await expect.element(page.getByText('이렇게 들었어요')).toBeVisible();
    await expect.element(page.getByText('점심은 국수 먹었어')).toBeVisible();
    const [sessionId, blob] = api.replyAudio.mock.calls[0] as [number, Blob];
    expect(sessionId).toBe(42);
    expect(blob.type).toBe('audio/wav');
  });

  it('음성을 못 알아들으면(503 COMPANION_STT_UNAVAILABLE) 안내만 보이고 말로 대답하기가 그대로 있다 - 글 입력 칸은 없다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockRejectedValue(apiError(503, 'COMPANION_STT_UNAVAILABLE'));
    await openTalk();
    await recordOnce();

    await expect.element(page.getByRole('alert')).toMatchTextContent('지금은 말을 알아듣기 어려워요. 잠시 후 다시 말씀해 주세요.');
    await expect.element(page.getByRole('button', { name: '말로 대답하기' })).toBeVisible();
    expect(page.getByRole('textbox').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: '글로 대답하기' }).elements()).toHaveLength(0);
  });
});

describe('표정 사진 (Chrome)', () => {
  it('묻지 않고 녹음과 함께 카메라를 켜고, 녹음 동안 찍은 JPEG 여러 장을 audio와 함께 보내고 카메라를 끈다', async () => {
    mediaDevices({ camera: 'allow' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '좋아' });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByText('카메라 켜짐')).toBeVisible();
    // 사진 동의 카드는 없다(2026-11-20 결정)
    expect(page.getByRole('button', { name: '사진 없이 할게요' }).elements()).toHaveLength(0);
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

  it('카메라를 거부하면 안내 없이 목소리만 보낸다, 다음 대답에서는 카메라를 다시 묻지 않는다', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '좋아' });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    await vi.waitFor(() => expect(cameraCalls()).toBe(1));
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(page.getByText('카메라를 쓸 수 없어', { exact: false }).elements()).toHaveLength(0);
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByText('좋으셨겠어요.')).toBeVisible();

    const [, , , frames] = api.replyAudio.mock.calls[0] as [number, Blob, AbortSignal, Blob[]];
    expect(frames).toEqual([]);
    // 사진이 없으면 내 대답 옆 얼굴도 없다
    expect(document.querySelector('img[alt="대답할 때 찍힌 내 얼굴"]')).toBeNull();

    await recordOnce();
    await vi.waitFor(() => expect(api.replyAudio).toHaveBeenCalledTimes(2));
    expect(cameraCalls()).toBe(1);
  });

  it('사진 때문에 거절되면(COMPANION_FRAME_INVALID) 사진을 끄고 목소리만 다시 보내게 한다', async () => {
    mediaDevices({ camera: 'allow' });
    api.replyAudio.mockRejectedValueOnce(apiError(400, 'COMPANION_FRAME_INVALID'));
    await openTalk();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByText('카메라 켜짐')).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByRole('alert')).toMatchTextContent('사진을 보내지 못했어요. 이제 목소리만 보낼게요. 다시 말씀해 주세요.');

    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '네.', ended: false, endReason: null, transcript: '응' });
    await recordOnce();
    await expect.element(page.getByText('네.', { exact: true })).toBeVisible();
    expect(cameraCalls()).toBe(1);
  });

  it('내 말풍선 옆 얼굴(I안): 녹음 중에는 "말씀하시는 중" 줄 오른쪽에 실시간 얼굴, 보낸 뒤에는 그 대답 옆에 마지막 사진', async () => {
    mediaDevices({ camera: 'allow' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '좋으셨겠어요.', ended: false, endReason: null, transcript: '좋아' });
    await openTalk();
    // 녹음 전에는 얼굴 칸이 없다
    expect(document.querySelector('figure')).toBeNull();
    expect(document.body.textContent).not.toContain('말씀하시는 중');

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByText('말씀하시는 중')).toBeVisible();
    const speaking = page.getByText('말씀하시는 중').element().closest('li') as HTMLElement;
    await vi.waitFor(() => expect(speaking.querySelector('figure video[aria-label="내 얼굴 미리보기"]')).not.toBeNull());
    const figure = speaking.querySelector('figure') as HTMLElement;
    expect(figure.className).toContain('listening');
    expect(figure.getBoundingClientRect().left).toBeGreaterThanOrEqual((speaking.querySelector('div') as HTMLElement).getBoundingClientRect().right);
    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.click(page.getByRole('button', { name: /다 했어요/ }));
    await expect.element(page.getByText('좋으셨겠어요.')).toBeVisible();

    // 실시간 얼굴은 사라지고, 내 대답 줄에 그 대답의 마지막 사진(메모리의 blob URL)이 남는다
    expect(document.querySelector('figure')).toBeNull();
    const myLine = page.getByText('좋아', { exact: true }).element().closest('li') as HTMLElement;
    const photo = myLine.querySelector('img[alt="대답할 때 찍힌 내 얼굴"]') as HTMLImageElement;
    expect(photo).not.toBeNull();
    expect(photo.src.startsWith('blob:')).toBe(true);

    // 대화를 닫으면 사진 URL을 해제한다(화면 메모리에만 두고 남기지 않는다)
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    api.replyAudio.mockResolvedValue({ turnNo: 2, reply: '고마워요.', ended: true, endReason: 'MAX_TURNS', transcript: '응' });
    await recordOnce();
    await page.getByRole('button', { name: '홈으로' }).click();
    expect(revoke).toHaveBeenCalledWith(photo.src);
    revoke.mockRestore();
  });
});

describe('테스트 계정 (Chrome)', () => {
  it('testMode가 아니면 테스트 칸·결과 칸이 없다', async () => {
    await openTalk();
    expect(page.getByText('테스트용').elements()).toHaveLength(0);
    expect(page.getByRole('heading', { name: /판정 결과/ }).elements()).toHaveLength(0);
  });

  it.each([['일반 계정', false], ['테스트 계정(testMode)', true]])('대화 화면에 글로 대답하기·대화 그만하기·판정 결과가 없다 - %s', async (_label, testMode) => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '네.', ended: false, endReason: null, transcript: '응' });
    const gone = () => {
      expect(page.getByRole('button', { name: '글로 대답하기' }).elements()).toHaveLength(0);
      expect(page.getByRole('button', { name: '대화 그만하기' }).elements()).toHaveLength(0);
      expect(page.getByText('판정 결과', { exact: false }).elements()).toHaveLength(0);
      expect(page.getByRole('textbox').elements()).toHaveLength(0);
      expect(page.getByRole('complementary').elements()).toHaveLength(0);
    };
    if (testMode) {
      api.today.mockResolvedValue(TEST_TODAY);
      await renderCompanion();
      await page.getByRole('button', { name: '바로 이야기하기' }).click();
      await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    } else {
      await openTalk();
    }
    gone();

    await recordOnce();
    await expect.element(page.getByText('네.', { exact: true })).toBeVisible();
    gone();
  });

  it('testMode가 아니면 테스트 푸시 주소로 와도 시작 버튼을 보이지 않는다', async () => {
    nav.search = 'testSlot=15:00';
    await renderCompanion();
    await expect.element(page.getByRole('button', { name: '이야기 시작하기' })).toBeVisible();
    expect(page.getByRole('button', { name: /대화 시작/ }).elements()).toHaveLength(0);
  });

  it('시간대를 골라 바로 시작하면 그 시간대 테스트 대화가 열린다', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    await renderCompanion();

    await expect.element(page.getByRole('heading', { name: '안부 말벗' })).toBeVisible();
    await page.getByRole('button', { name: '오후 3시' }).click();
    await expect.element(page.getByRole('button', { name: '오후 3시' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '바로 이야기하기' }).click();

    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
    expect(api.openTest).toHaveBeenCalledWith('15:00');
    expect(api.open).not.toHaveBeenCalled();
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
  function turnReply(turnNo: number, ended: boolean) {
    return { turnNo, reply: '그러셨군요. 또 무엇을 하셨어요?', ended, endReason: ended ? 'MAX_TURNS' : null, transcript: '대답' };
  }

  // endAtTurn 번째 대답에서 서버가 대화를 끝낸다
  async function startTestTalk(endAtTurn = Number.POSITIVE_INFINITY) {
    mediaDevices({ camera: 'deny' });
    api.today.mockResolvedValue(TEST_TODAY);
    let turn = 0;
    api.replyAudio.mockImplementation(async () => {
      turn += 1;
      return turnReply(turn, turn >= endAtTurn);
    });
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await expect.element(page.getByText('오후는 어떻게 보내고 계세요?')).toBeVisible();
  }

  it('테스트 시작 화면: 설명 문장 없이 말벗 인사 말풍선(두 문장)·시간대 5칸·두 버튼', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    await renderCompanion();

    await expect.element(page.getByText('안녕하세요.', { exact: true })).toBeVisible();
    // TEST_TODAY는 낮 12시가 열려 있다 - 고른 칸이 없으면 위 안내 띠와 같은 시간대
    await expect.element(page.getByText('낮 12시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();
    expect(page.getByText('시간대를 고르고 바로 시작하거나', { exact: false }).elements()).toHaveLength(0);
    expect(page.getByRole('group', { name: '안부 시간대' }).getByRole('button').elements()).toHaveLength(5);
    await page.getByRole('button', { name: '오후 6시' }).click();
    await expect.element(page.getByText('오후 6시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '안부 알림 받아 보기' })).toBeVisible();
  });

  it('말벗 문장은 문장 끝(?·.) 뒤에서 줄을 나눠 두 줄로 보인다', async () => {
    await startTestTalk();
    await recordOnce();

    const first = page.getByText('그러셨군요.', { exact: true }).element() as HTMLElement;
    const second = page.getByText('또 무엇을 하셨어요?', { exact: true }).element() as HTMLElement;
    expect(second.getBoundingClientRect().top).toBeGreaterThan(first.getBoundingClientRect().top);
  });

  it.each([[375, 812], [768, 1024], [1280, 800]])('마침 카드(%i×%i): 제목은 "주셔서" 뒤에서만 두 줄, 카드 위가 화면 안, 가로 넘침 없음', async (width, height) => {
    await page.viewport(width, height);
    await startTestTalk(2);
    await recordOnce();
    await expect.element(page.getByText('또 무엇을 하셨어요?', { exact: true }).first()).toBeVisible();
    await recordOnce();

    const title = page.getByRole('heading', { name: END_TITLE });
    await expect.element(title).toBeVisible();
    const h2 = title.element() as HTMLElement;
    expect(h2.querySelectorAll('br')).toHaveLength(1);
    expect(Math.round(h2.getBoundingClientRect().height / parseFloat(getComputedStyle(h2).lineHeight))).toBe(2);
    expect(parseFloat(getComputedStyle(h2).fontSize)).toBeGreaterThanOrEqual(20);
    const card = h2.closest('section') as HTMLElement;
    // 부드러운 스크롤이 끝날 때까지 기다린다 - 카드 위가 화면 안(0 이상, 화면 높이 미만)
    await expect.poll(() => { const top = card.getBoundingClientRect().top; return top >= 0 && top < height; }, { timeout: 5000 }).toBe(true);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });
});

describe('안내 문구 배치 (Chrome, 점검 M-2)', () => {
  it.each([[1180, 820], [1024, 768], [768, 1024]])('%i×%i: 동의 전·후 안내 문구가 있는 시작 화면이 가로로 넘치지 않는다', async (width, height) => {
    await page.viewport(width, height);
    const boxSizing = document.createElement('style');
    boxSizing.textContent = '*, *::before, *::after { box-sizing: border-box; }';
    document.head.appendChild(boxSizing);
    try {
      for (const consent of [CONSENT_NEW, { ...CONSENT_NEW, consented: true, consentedAt: '2026-11-12T10:00:00+09:00' }]) {
        api.consent.mockResolvedValue(consent);
        const view = await renderCompanion();
        const text = consent.consented ? '목소리와 얼굴 사진은 AI 서버로 보내고 저장하지 않아요.' : '얼굴 사진을 AI 서버로 보내요.';
        await expect.element(page.getByText(text, { exact: false })).toBeVisible();
        const r = page.getByText(text, { exact: false }).element().getBoundingClientRect();
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.right).toBeLessThanOrEqual(window.innerWidth + 1);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
        await view.unmount();
      }
    } finally {
      boxSizing.remove();
    }
  });
});
describe('대화 내용 공유 동의 (Chrome)', () => {
  it('처음 대화를 시작하면 먼저 묻고, 보여 줄게요를 고르면 동의를 저장한 뒤 시작한다', async () => {
    api.consent.mockResolvedValue(CONSENT_NEW);
    api.setConsent.mockResolvedValue({ ...CONSENT_NEW, consented: true, consentedAt: '2026-11-12T10:00:00+09:00' });
    await renderCompanion();
    await expect.element(page.getByText('기분을 살피려고 대답과 얼굴 사진을 AI 서버로 보내요. 대답한 말과 목소리, 얼굴 사진은 저장하지 않아요.')).toBeVisible();

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

describe('기능 점검 반영 (Chrome)', () => {
  it('최대 턴 수를 모르면(maxTurns null) 진행 점도 숫자도 그리지 않는다(L-1)', async () => {
    api.open.mockResolvedValue({ ...SESSION, maxTurns: null });
    await openTalk();
    expect(document.querySelectorAll('[class*="progressDots"]')).toHaveLength(0);
    expect(page.getByText('번째 대답', { exact: false }).elements()).toHaveLength(0);
  });

  it('동의 상태를 받기 전에 시작을 눌러도 받아 본 뒤 동의를 묻는다(L-2)', async () => {
    let resolveConsent: (value: IWardCompanionTranscriptConsent) => void = () => undefined;
    api.consent.mockImplementation(() => new Promise(resolve => { resolveConsent = resolve; }));
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    expect(api.open).not.toHaveBeenCalled();

    resolveConsent(CONSENT_NEW);
    await expect.element(page.getByRole('heading', { name: '안부 대화 내용을 가족에게 보여 줄까요?' })).toBeVisible();
    expect(api.open).not.toHaveBeenCalled();
  });

  it('보관 안내의 일수는 서버 값(retentionDays)을 쓴다(L-3)', async () => {
    api.consent.mockResolvedValue({ ...CONSENT_ASKED, retentionDays: 14 });
    await renderCompanion();
    await expect.element(page.getByText('대답한 말은 가족이 볼 수 있게 14일 동안 보관해요.', { exact: false })).toBeVisible();
  });

  it('환경설정에서 정한 뒤(물어봄 표시)에는 철회 상태여도 다시 묻지 않는다(M-1)', async () => {
    window.localStorage.setItem('sb-companion-consent-asked', '1');
    api.consent.mockResolvedValue(CONSENT_NEW);
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
    expect(page.getByRole('heading', { name: '안부 대화 내용을 가족에게 보여 줄까요?' }).elements()).toHaveLength(0);
  });
});

describe('이어 하는 대화 턴 수·판정 칸 제목 (Chrome)', () => {
  it('이어 하는 대화는 서버가 준 turnCount부터 센다 - 3번 마쳤으면 "8번 중 4번째"·점 3개 채움', async () => {
    api.open.mockResolvedValue({ ...SESSION, resumed: true, turnCount: 3 });
    await openTalk();
    await expect.element(page.getByText('하던 이야기를 이어서 해요.')).toBeVisible();
    await expect.element(page.getByText('8번 중 4번째 대답')).toBeVisible();
    expect(document.querySelectorAll('[class*="progressDots"] i[class*="filled"]')).toHaveLength(3);
  });

  it('turnCount가 없는 응답(옛 서버)은 지금처럼 0부터 센다', async () => {
    api.open.mockResolvedValue({ ...SESSION, resumed: true });
    await openTalk();
    await expect.element(page.getByText('8번 중 1번째 대답')).toBeVisible();
    expect(document.querySelectorAll('[class*="progressDots"] i[class*="filled"]')).toHaveLength(0);
  });
});

// toBeVisible은 화면 밖 요소도 '보임'으로 본다 - 배치는 좌표로 확인한다(점검 L-3)
function insideViewportHeight(el: Element) {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight + 1;
}

function insideViewport(el: Element) {
  const r = el.getBoundingClientRect();
  return r.left >= 0 && r.right <= window.innerWidth + 1;
}

describe('폰 배치 회귀 (Chrome, 점검 H-1·M-1·L-1)', () => {
  it('폰에서 말하기 버튼과 녹음 중 내 얼굴이 화면 안에 있고 가로로 넘치지 않는다', async () => {
    await page.viewport(390, 844);
    mediaDevices({ camera: 'allow' });
    await openTalk();
    const answer = page.getByRole('region', { name: '대답하기' });
    expect(insideViewport(answer.getByRole('button', { name: '말로 대답하기' }).element())).toBe(true);
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await vi.waitFor(() => expect(document.querySelector('figure video')).not.toBeNull());
    expect(insideViewport(document.querySelector('figure') as Element)).toBe(true);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
  });

  it('녹음을 누르면 녹음 안내가 생겨도 녹음 버튼이 화면 아래로 잘리지 않는다(2026-11-22)', async () => {
    await page.viewport(1280, 520);
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '경로당에서 즐거운 시간 보내셨군요. 영자랑 이야기는 어떠셨나요?', ended: false, endReason: null, transcript: '경로당에서 영자랑 이야기 많이 했어' });
    await openTalk();
    await recordOnce();
    await expect.element(page.getByText(/영자랑 이야기는/)).toBeVisible();
    await page.getByRole('button', { name: '말로 대답하기' }).click();

    expect(document.body.textContent).not.toContain('말씀을 마치면');
    expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight); // 화면보다 길어 스크롤이 필요한 상황인지
    await vi.waitFor(() => expect(insideViewportHeight(page.getByRole('button', { name: /다 했어요/ }).element())).toBe(true));
  });

  it('폰 시작 화면은 글자 아주 크게(1.47배)에서도 가로로 넘치지 않는다(M-1)', async () => {
    await page.viewport(390, 844);
    document.documentElement.style.setProperty('--ward-font-scale', '1.47');
    // 실제 앱의 전역 box-sizing(globals.css)과 같은 조건으로 잰다(GuardianMedicationContent.layout 테스트와 같은 방식)
    const boxSizing = document.createElement('style');
    boxSizing.dataset.testBoxSizing = '';
    boxSizing.textContent = '*, *::before, *::after { box-sizing: border-box; }';
    document.head.appendChild(boxSizing);
    try {
      api.today.mockResolvedValue(TEST_TODAY);
      await renderCompanion();
      await expect.element(page.getByRole('button', { name: '바로 이야기하기' })).toBeVisible();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
      // 넘침 원인이던 머리 오른쪽 여백(테스트 표시 자리 72px)은 폰에서 두지 않는다 - 표시는 머리 위 줄
      const heroHead = document.querySelector('[class*="heroHead"]') as HTMLElement;
      expect(getComputedStyle(heroHead).paddingRight).toBe('0px');
    } finally {
      document.documentElement.style.removeProperty('--ward-font-scale');
      boxSizing.remove();
    }
  });
});

describe('말벗 목소리 (Chrome)', () => {
  const VOICE = new Blob([new Uint8Array(64)], { type: 'audio/mpeg' });
  // 재생은 가짜로 - 실제 소리를 내지 않고 어떤 src로 몇 번 틀었는지만 본다(무음 data: 는 대화 시작 때 권한을 얻는 재생)
  let played: string[] = [];
  let playImpl: (src: string) => Promise<void> = async () => undefined;
  const blobPlays = () => played.filter(src => src.startsWith('blob:'));
  const speakCount = (text: string) => api.speak.mock.calls.filter(([said]) => said === text).length;
  let pauseSpy: ReturnType<typeof vi.spyOn>;
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    played = [];
    playImpl = async () => undefined;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push(this.src);
      return playImpl(this.src);
    });
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    api.open.mockResolvedValue({ ...SESSION, audio: { index: 0 } });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('질문 목소리가 오면 받아서 틀고 기기 음성으로 읽지 않는다', async () => {
    api.audio.mockResolvedValue(VOICE);
    await openTalk();

    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
    expect(api.audio).toHaveBeenCalledWith(42, 0, expect.any(AbortSignal));
    expect(played[0]).toMatch(/^data:audio\/wav/);
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);
  });

  it.each([
    ['404', () => api.audio.mockRejectedValue(Object.assign(new Error('x'), { status: 404 }))],
    ['503', () => api.audio.mockRejectedValue(Object.assign(new Error('x'), { status: 503 }))],
    ['네트워크 오류', () => api.audio.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('목소리를 못 받으면(%s) 기기 음성으로 한 번만 읽는다', async (_name, arrange) => {
    arrange();
    await openTalk();

    await vi.waitFor(() => expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1));
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1);
    expect(blobPlays()).toHaveLength(0);
  });

  it('audio가 없으면 받지 않고 기기 음성으로 읽는다', async () => {
    api.open.mockResolvedValue(SESSION);
    await openTalk();

    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1);
    expect(api.audio).not.toHaveBeenCalled();
  });

  it('재생이 실패하면(NotAllowedError 말고) 기기 음성으로 읽는다', async () => {
    api.audio.mockResolvedValue(VOICE);
    playImpl = async src => {
      if (src.startsWith('blob:')) throw new DOMException('bad', 'NotSupportedError');
    };
    await openTalk();

    await vi.waitFor(() => expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1));
  });

  it('8초 안에 못 받으면 대신 읽고, 늦게 온 목소리는 버린다', { timeout: 20_000 }, async () => {
    let arrive: (blob: Blob) => void = () => undefined;
    let signal: AbortSignal | undefined;
    api.audio.mockImplementation((_id: number, _index: number, given: AbortSignal) => {
      signal = given;
      return new Promise<Blob>(resolve => {
        arrive = resolve;
      });
    });
    await openTalk();
    await new Promise(resolve => setTimeout(resolve, 7_000));
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);

    await vi.waitFor(() => expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1), { timeout: 3_000 });
    expect(signal?.aborted).toBe(true);
    // abort를 무시하고 늦게 도착한 경우
    arrive(VOICE);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(blobPlays()).toHaveLength(0);
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1);
  });

  it('녹음이 시작되면 받던 목소리를 버리고 대신 읽지도 않는다', async () => {
    mediaDevices({ camera: 'deny' });
    let arrive: (blob: Blob) => void = () => undefined;
    let signal: AbortSignal | undefined;
    api.audio.mockImplementation((_id: number, _index: number, given: AbortSignal) => {
      signal = given;
      return new Promise<Blob>(resolve => {
        arrive = resolve;
      });
    });
    await openTalk();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    expect(signal?.aborted).toBe(true);
    arrive(VOICE);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(blobPlays()).toHaveLength(0);
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);
  });

  it('틀고 있는 목소리는 녹음이 시작되면 멈추고 해제한다', async () => {
    mediaDevices({ camera: 'deny' });
    api.audio.mockResolvedValue(VOICE);
    await openTalk();
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
    const url = blobPlays()[0];
    pauseSpy.mockClear();

    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    expect(pauseSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith(url);
  });

  it('자동 재생이 막히면(NotAllowedError) "들려 주세요"를 보이고 누르면 튼다', async () => {
    api.audio.mockResolvedValue(VOICE);
    playImpl = async () => {
      throw new DOMException('blocked', 'NotAllowedError');
    };
    await openTalk();
    await expect.element(page.getByRole('button', { name: '들려 주세요' })).toBeVisible();
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);

    playImpl = async () => undefined;
    await page.getByRole('button', { name: '들려 주세요' }).click();
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(2));
    await expect.element(page.getByRole('button', { name: '다시 듣기' })).toBeVisible();
    expect(api.audio).toHaveBeenCalledTimes(1);
  });

  it('다시 듣기는 받아 둔 목소리를 다시 틀고 다시 받지 않는다', async () => {
    api.audio.mockResolvedValue(VOICE);
    await openTalk();
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));

    await page.getByRole('button', { name: '다시 듣기' }).click();
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(2));
    expect(api.audio).toHaveBeenCalledTimes(1);
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);
  });

  it('목소리를 못 받은 문장의 다시 듣기는 기기 음성으로 읽는다', async () => {
    await openTalk();
    await vi.waitFor(() => expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1));

    await page.getByRole('button', { name: '다시 듣기' }).click();
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(2);
    expect(api.audio).toHaveBeenCalledTimes(1);
  });

  it('다음 문장이 오면 앞 목소리를 멈추고 해제한 뒤 새 목소리를 튼다', async () => {
    api.audio.mockResolvedValue(VOICE);
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockResolvedValue({ turnNo: 1, reply: '국수 맛있으셨겠어요.', ended: false, endReason: null, transcript: '국수 먹었어', audio: { index: 1 } });
    await openTalk();
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
    const first = blobPlays()[0];

    await recordOnce();

    await vi.waitFor(() => expect(blobPlays()).toHaveLength(2));
    expect(revokeSpy).toHaveBeenCalledWith(first);
    expect(api.audio).toHaveBeenLastCalledWith(42, 1, expect.any(AbortSignal));
    expect(speakCount('국수 맛있으셨겠어요.')).toBe(0);
  });

  it('받는 중인 문장의 다시 듣기는 받기를 끊지 않고, 도착한 목소리를 그대로 튼다(점검 L-3)', async () => {
    let arrive: (blob: Blob) => void = () => undefined;
    let signal: AbortSignal | undefined;
    api.audio.mockImplementation((_id: number, _index: number, given: AbortSignal) => {
      signal = given;
      return new Promise<Blob>(resolve => {
        arrive = resolve;
      });
    });
    await openTalk();

    await page.getByRole('button', { name: '다시 듣기' }).click();
    expect(signal?.aborted).toBe(false);
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);
    arrive(VOICE);
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(0);
  });

  it('audio.index가 정수가 아니면 받지 않고 기기 음성으로 읽는다(점검 L-4)', async () => {
    api.open.mockResolvedValue({ ...SESSION, audio: { index: '0' } });
    await openTalk();

    expect(speakCount('점심은 무엇을 드셨어요?')).toBe(1);
    expect(api.audio).not.toHaveBeenCalled();
  });

  it('테스트 계정 시작도 누른 순간 무음으로 권한을 얻고 질문 목소리를 튼다(점검 L-4)', async () => {
    api.today.mockResolvedValue(TEST_TODAY);
    api.openTest.mockResolvedValue({ ...SESSION, slot: '15:00', question: '오후는 어떻게 보내고 계세요?', audio: { index: 0 } });
    api.audio.mockResolvedValue(VOICE);
    await renderCompanion();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();

    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
    expect(played[0]).toMatch(/^data:audio\/wav/);
    expect(speakCount('오후는 어떻게 보내고 계세요?')).toBe(0);
  });

  it('동의 카드에서 보여 줄게요를 누르면 저장을 기다리기 전에 권한을 얻는다(점검 L-1)', async () => {
    api.consent.mockResolvedValue(CONSENT_NEW);
    let saved: (value: IWardCompanionTranscriptConsent) => void = () => undefined;
    api.setConsent.mockImplementation(() => new Promise(resolve => {
      saved = resolve;
    }));
    api.audio.mockResolvedValue(VOICE);
    await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await expect.element(page.getByRole('heading', { name: '안부 대화 내용을 가족에게 보여 줄까요?' })).toBeVisible();
    played = [];

    await page.getByRole('button', { name: '보여 줄게요' }).click();
    // 저장이 끝나기 전 - 이미 무음 재생으로 권한을 얻었다
    expect(played.filter(src => src.startsWith('data:'))).toHaveLength(1);
    saved({ ...CONSENT_NEW, consented: true, consentedAt: '2026-11-13T10:00:00+09:00' });
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
  });

  it('화면을 떠나면 멈추고 해제한다', async () => {
    api.audio.mockResolvedValue(VOICE);
    const screen = await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await vi.waitFor(() => expect(blobPlays()).toHaveLength(1));
    const url = blobPlays()[0];
    pauseSpy.mockClear();

    screen.unmount();
    expect(pauseSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith(url);
  });
});

// 2026-11-20: 안부 인사 시간대에 오늘 안내 띠가 뜨면 테스트 카드와 함께 태블릿 화면을 넘쳐 아래가 잘리고,
// 띠는 '오후 3시'인데 시간대 칸·말풍선은 첫 칸 '오전 9시'로 보이던 것
describe('테스트 시작 화면 - 오늘 안내 띠와 함께 (Chrome)', () => {
  const OPEN_3PM = { ...today('15:00', ['DONE', 'MISSED', 'AVAILABLE', 'UPCOMING', 'UPCOMING']), testMode: true };
  const CLOSED = { ...today(null, ['DONE', 'MISSED', 'DONE', 'UPCOMING', 'UPCOMING']), testMode: true };

  it('고른 칸이 없으면 띠와 같은 시간대(오후 3시)를 고르고 말풍선도 같게, 고르면 그 칸을 따른다', async () => {
    api.today.mockResolvedValue(OPEN_3PM);
    await renderCompanion();

    await expect.element(page.getByRole('heading', { name: '오후 3시 안부 인사 시간이에요' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '오후 3시', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByText('오후 3시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '오후 6시', exact: true }).click();
    await expect.element(page.getByText('오후 6시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '바로 이야기하기' }).click();
    await vi.waitFor(() => expect(api.openTest).toHaveBeenCalledWith('18:00'));
  });

  it('열린 시간대가 없으면(띠 없음) 첫 칸(오전 9시)을 고른다', async () => {
    api.today.mockResolvedValue(CLOSED);
    await renderCompanion();

    await expect.element(page.getByRole('button', { name: '오전 9시', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(page.getByRole('heading', { name: /안부 인사 시간이에요/ }).elements()).toHaveLength(0);
  });

  it('보던 중 시간대 창이 닫혀도(현황 다시 받기) 고른 것으로 둔 오후 3시를 유지한다(#307 점검 L-1)', async () => {
    api.today.mockResolvedValue(OPEN_3PM);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderCompanion(client);
    await expect.element(page.getByRole('button', { name: '오후 3시', exact: true })).toHaveAttribute('aria-pressed', 'true');

    api.today.mockResolvedValue(CLOSED);
    await client.invalidateQueries();
    await expect.poll(() => page.getByRole('heading', { name: /안부 인사 시간이에요/ }).elements().length).toBe(0);
    await expect.element(page.getByRole('button', { name: '오후 3시', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByText('오후 3시 안부 인사를 나눠 볼까요?', { exact: true })).toBeVisible();
  });

  it('테스트 푸시가 띠와 같은 시간대면 띠를 숨겨 시작 버튼이 하나만 보인다(#307 점검 M-1)', async () => {
    api.today.mockResolvedValue(OPEN_3PM);
    nav.search = '?testSlot=15:00';
    await renderCompanion();
    await expect.element(page.getByRole('button', { name: '오후 3시 대화 시작' })).toBeVisible();
    expect(page.getByRole('heading', { name: '오후 3시 안부 인사 시간이에요' }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: '이야기 시작하기' }).elements()).toHaveLength(0);
  });

  it('테스트 푸시가 띠와 다른 시간대면 띠도 그대로 보인다', async () => {
    api.today.mockResolvedValue(OPEN_3PM);
    nav.search = '?testSlot=18:00';
    await renderCompanion();
    await expect.element(page.getByRole('button', { name: '오후 6시 대화 시작' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: '오후 3시 안부 인사 시간이에요' })).toBeVisible();
  });

  it('같은 시간대 푸시여도 하던 대화(IN_PROGRESS)가 있으면 "이어서 이야기하기" 띠를 남긴다(#313 점검 M-1)', async () => {
    api.today.mockResolvedValue({ ...today('15:00', ['DONE', 'MISSED', 'IN_PROGRESS', 'UPCOMING', 'UPCOMING']), testMode: true });
    nav.search = '?testSlot=15:00';
    await renderCompanion();
    await expect.element(page.getByRole('button', { name: '오후 3시 대화 시작' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: '이어서 이야기하기' })).toBeVisible();
  });

  it('같은 시간대 푸시 화면에서 현황 다시 받기가 실패하면 띠 자리의 오류 안내를 보인다(#313 점검 L-2)', async () => {
    api.today.mockResolvedValue(OPEN_3PM);
    nav.search = '?testSlot=15:00';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderCompanion(client);
    await expect.element(page.getByRole('button', { name: '오후 3시 대화 시작' })).toBeVisible();
    expect(page.getByRole('heading', { name: '오후 3시 안부 인사 시간이에요' }).elements()).toHaveLength(0);

    api.today.mockRejectedValue(new Error('network'));
    await client.invalidateQueries();
    await expect.element(page.getByText('오늘 안부 대화를 불러오지 못했어요.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: '오후 3시 대화 시작' })).toBeVisible();
  });

  it('좁은 태블릿(700px)·글자 아주 크게(1.47배)에서는 띠·푸시 칸 버튼이 제목 아래 줄로 내려간다(#313 점검 L-1)', async () => {
    await page.viewport(700, 1000);
    document.documentElement.style.setProperty('--ward-font-scale', '1.47');
    try {
      api.today.mockResolvedValue(OPEN_3PM);
      nav.search = '?testSlot=18:00';
      await renderCompanion();
      await expect.element(page.getByRole('button', { name: '오후 6시 대화 시작' })).toBeVisible();
      for (const id of ['companion-hero-title', 'companion-test-entry-title']) {
        const box = document.querySelector(`[aria-labelledby="${id}"]`) as HTMLElement;
        const heading = (box.querySelector('h2') as HTMLElement).getBoundingClientRect();
        const start = (box.querySelector('button') as HTMLElement).getBoundingClientRect();
        expect(start.top).toBeGreaterThanOrEqual(heading.bottom);
        expect(start.right).toBeLessThanOrEqual(box.getBoundingClientRect().right + 1);
      }
    } finally {
      document.documentElement.style.removeProperty('--ward-font-scale');
    }
  });

  // 화면 위아래 몫(머리줄 + 본문 여백) - 넓은 화면 156px(.page 채움 기준과 같음)·세로 태블릿 132px(gosky 실측)
  it.each([
    [1180, 820, 156, true], [1024, 768, 156, true], [820, 1180, 132, true], [768, 1024, 132, true],
    [1180, 820, 156, false], [1024, 768, 156, false], [820, 1180, 132, false], [768, 1024, 132, false],
  ])('%i×%i: 띠 + 두 카드가 화면 높이 안에 들어간다(띠 있음 %s)', async (width, height, chrome, banner) => {
    await page.viewport(width, height);
    const boxSizing = document.createElement('style');
    boxSizing.textContent = '*, *::before, *::after { box-sizing: border-box; }';
    document.head.appendChild(boxSizing);
    try {
      api.today.mockResolvedValue(banner ? OPEN_3PM : CLOSED);
      await renderCompanion();
      await expect.element(page.getByRole('button', { name: '안부 알림 받아 보기' })).toBeVisible();
      const cards = document.querySelector('section[aria-label="안부 말벗 테스트"]') as HTMLElement;
      const pageEl = cards.parentElement as HTMLElement;
      expect(pageEl.getBoundingClientRect().height).toBeLessThanOrEqual(height - chrome + 1);
      const hero = document.querySelector('[aria-labelledby="companion-hero-title"]');
      expect(Boolean(hero)).toBe(banner);
      if (hero) {
        // 띠는 한 줄 - 시작 버튼이 제목 오른쪽에 놓인다
        const heading = hero.querySelector('h2') as HTMLElement;
        const start = hero.querySelector('button') as HTMLElement;
        expect(start.getBoundingClientRect().left).toBeGreaterThan(heading.getBoundingClientRect().right);
      }
    } finally {
      boxSizing.remove();
    }
  });

  // 띠와 같은 시간대 테스트 푸시로 들어오면 띠 대신 한 줄로 줄인 푸시 칸 + 두 카드(#307 점검 M-1).
  // 다른 시간대 푸시는 띠까지 셋이 떠 태블릿에서 49~101px 남는다 - 드문 겹침이라 화면 스크롤에 맡긴다(시니어 글자·버튼을 더 줄이지 않음)
  it.each([
    [1180, 820, 156], [1024, 768, 156], [820, 1180, 132], [768, 1024, 132],
  ])('%i×%i: 띠와 같은 시간대 테스트 푸시로 들어와도 화면 높이 안에 들어간다', async (width, height, chrome) => {
    await page.viewport(width, height);
    const boxSizing = document.createElement('style');
    boxSizing.textContent = '*, *::before, *::after { box-sizing: border-box; }';
    document.head.appendChild(boxSizing);
    try {
      api.today.mockResolvedValue(OPEN_3PM);
      nav.search = '?testSlot=15:00';
      await renderCompanion();
      await expect.element(page.getByRole('button', { name: '안부 알림 받아 보기' })).toBeVisible();
      const cards = document.querySelector('section[aria-label="안부 말벗 테스트"]') as HTMLElement;
      const pageEl = cards.parentElement as HTMLElement;
      expect(pageEl.getBoundingClientRect().height).toBeLessThanOrEqual(height - chrome + 1);
    } finally {
      boxSizing.remove();
    }
  });
});

describe('마이크를 쓸 수 없을 때 (Chrome, FE 디자인 점검 D-1·D-3)', () => {
  it('마이크 권한을 거부하면 말벗 문구와 [홈으로]가 보이고, 권한을 켠 뒤 다시 누를 수 있게 말하기 버튼은 남는다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await openTalk();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));

    await expect.element(page.getByRole('alert')).toMatchTextContent('마이크를 쓸 수 있게 허용해 주셔야 말벗과 이야기할 수 있어요.');
    await expect.element(page.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/ward');
    await expect.element(page.getByRole('button', { name: '말로 대답하기' })).toBeVisible();
    expect(page.getByText('글로 입력', { exact: false }).elements()).toHaveLength(0);
    expect(api.replyAudio).not.toHaveBeenCalled();
  });

  it('이 기기에서 음성을 쓸 수 없으면(미지원) 말벗 문구와 [홈으로]만 보이고 말하기 버튼은 숨는다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    await openTalk();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));

    await expect.element(page.getByRole('alert')).toMatchTextContent('이 기기에서는 말벗과 목소리로 이야기할 수 없어요.');
    await expect.element(page.getByRole('link', { name: '홈으로' })).toBeVisible();
    expect(page.getByRole('button', { name: '말로 대답하기' }).elements()).toHaveLength(0);
    expect(page.getByText('글로 입력', { exact: false }).elements()).toHaveLength(0);
  });

  it('보내기 실패 안내에는 [홈으로]를 두지 않는다(다시 말하면 된다)', async () => {
    mediaDevices({ camera: 'deny' });
    api.replyAudio.mockRejectedValue(apiError(503, 'COMPANION_STT_UNAVAILABLE'));
    await openTalk();
    await recordOnce();

    await expect.element(page.getByRole('alert')).toMatchTextContent('지금은 말을 알아듣기 어려워요.');
    expect(page.getByRole('link', { name: '홈으로' }).elements()).toHaveLength(0);
  });

  it('태블릿(1280×800): 말하기 버튼이 화면 안에 있고 가로로 넘치지 않는다', async () => {
    await page.viewport(1280, 800);
    mediaDevices({ camera: 'deny' });
    await openTalk();

    const mic = page.getByRole('button', { name: '말로 대답하기' }).element() as HTMLElement;
    const box = mic.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(800);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1280);
  });

  it('녹음 중에 화면을 떠나면 마이크·카메라가 꺼진다', async () => {
    const tracks: MediaStreamTrack[] = [];
    getUserMedia.mockImplementation(async (constraints: MediaStreamConstraints) => {
      const stream = constraints.video ? fakeCameraStream() : fakeMicStream();
      tracks.push(...stream.getTracks());
      return stream;
    });
    const screen = await renderCompanion();
    await page.getByRole('button', { name: '이야기 시작하기' }).click();
    await expect.element(page.getByText('점심은 무엇을 드셨어요?')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: '말로 대답하기' }));
    await expect.element(page.getByRole('button', { name: /다 했어요/ })).toBeInTheDocument();
    await vi.waitFor(() => expect(tracks.length).toBeGreaterThanOrEqual(2));

    screen.unmount();

    await vi.waitFor(() => expect(tracks.every(track => track.readyState === 'ended')).toBe(true));
    expect(api.replyAudio).not.toHaveBeenCalled();
  });
});