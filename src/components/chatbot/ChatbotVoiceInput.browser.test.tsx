// 챗봇 마이크 음성 입력 - 실제 Chrome에서 돈다(`npm run test:browser`).
// 마이크 대신 Web Audio 발진기 스트림을 getUserMedia 결과로 넘겨 녹음·WAV 인코딩·업로드 흐름을 그대로 탄다.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import ChatbotContent from './ChatbotContent';

const api = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  getChatLogs: vi.fn(),
  transcribe: vi.fn(),
  role: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/service/api/chat', () => ({
  sendChatMessage: api.sendChatMessage,
  getChatLogs: api.getChatLogs,
  getChatErrorMessage: () => '잠시 후 다시 시도해 주세요.',
}));
vi.mock('@/service/api/chatStt', () => ({ transcribeChatAudio: api.transcribe }));
vi.mock('@/service/query/user/profile', () => ({
  myProfileQueryOptions: { queryKey: ['test-profile'], queryFn: () => ({ name: '박순자', profileImage: null }) },
}));
vi.mock('@/utils/auth/userProfile', () => ({ getUserProfileData: (response: unknown) => response }));
vi.mock('@/lib/auth/tokenStore', () => ({ getAuthRole: api.role, getAccessTokenSubject: () => 'user-1' }));
vi.mock('@/hooks/useActiveConnections', () => ({
  useGuardianActiveWards: () => ({ activeWards: [], isLoading: false }),
}));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));
vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => <span data-testid="avatar" /> }));
vi.mock('./ChatToolCard', () => ({ default: () => null }));
vi.mock('./ChatUiPrompt', () => ({ default: () => null }));

function renderChat(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

// 말소리 대신 440Hz 소리를 내는 스트림. gain을 0으로 두면 무음(말 없음), setToneLevel(0)으로 말을 멈춘 것처럼 만든다
let toneContext: AudioContext | null = null;
let toneTracks: MediaStreamTrack[] = [];
let toneGain: GainNode | null = null;
function fakeMicStream(level = 1) {
  toneContext = new AudioContext();
  const oscillator = toneContext.createOscillator();
  toneGain = toneContext.createGain();
  toneGain.gain.value = level;
  const destination = toneContext.createMediaStreamDestination();
  oscillator.connect(toneGain);
  toneGain.connect(destination);
  oscillator.start();
  toneTracks = destination.stream.getTracks();
  return destination.stream;
}
function setToneLevel(level: number) {
  toneGain!.gain.value = level;
}

function sttError(status: number, code: string) {
  return new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: { code },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

const getUserMedia = vi.fn();

beforeEach(() => {
  // 대화는 탭 저장소에 남는다(2026-11-11) - 앞 테스트의 대화가 이어지지 않게 비운다
  window.sessionStorage.clear();
  api.role.mockReturnValue('WARD');
  api.getChatLogs.mockResolvedValue([]);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
});

afterEach(async () => {
  vi.clearAllMocks();
  getUserMedia.mockReset();
  await toneContext?.close().catch(() => undefined);
  toneContext = null;
});

async function recordFor(ms: number) {
  await userEvent.click(page.getByRole('button', { name: '말로 입력하기' }));
  await expect.element(page.getByRole('button', { name: '녹음 끝내기' })).toBeInTheDocument();
  await new Promise(resolve => setTimeout(resolve, ms));
  await userEvent.click(page.getByRole('button', { name: '녹음 끝내기' }));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('챗봇 마이크 음성 입력', () => {
  it('피보호자·보호자 화면 모두 마이크 버튼이 보인다', async () => {
    renderChat(<ChatbotContent variant="ward" />);
    await expect.element(page.getByRole('button', { name: '말로 입력하기' })).toBeInTheDocument();
  });

  it('피보호자: 권한을 거부하면 안내하고 서버를 부르지 않으며, 그때만 [글자로 쓰기]로 입력창을 열 수 있다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    renderChat(<ChatbotContent variant="ward" />);
    expect(page.getByRole('button', { name: '글자로 쓰기' }).elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: '말로 입력하기' }));

    await expect.element(page.getByText('마이크 권한을 허용해 주세요.')).toBeInTheDocument();
    expect(api.transcribe).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole('button', { name: '글자로 쓰기' }));
    await expect.element(page.getByRole('textbox', { name: '궁금한 점 입력' })).toBeVisible();
  });

  it('피보호자: 녹음을 끝내면 16kHz WAV를 올리고 받은 글자를 바로 보낸다(보낸 말풍선으로 확인)', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockResolvedValue('무릎이 아파요');
    api.sendChatMessage.mockResolvedValue({ reply: '찜질해 보세요.', engine: 'ai', type: 'message' });
    renderChat(<ChatbotContent variant="ward" />);

    await recordFor(600);

    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1));
    expect(api.sendChatMessage.mock.calls[0][0].message).toBe('무릎이 아파요');
    await expect.element(page.getByText('무릎이 아파요', { exact: true })).toBeVisible();
    expect(page.getByRole('textbox', { name: '궁금한 점 입력' }).elements()).toHaveLength(0);

    const blob = api.transcribe.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('audio/wav');
    const view = new DataView(await blob.arrayBuffer());
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(22, true)).toBe(1);
    // 녹음이 끝나면 마이크 트랙을 끈다
    expect(toneTracks.every(track => track.readyState === 'ended')).toBe(true);
  });

  it('보호자: 받은 글자는 입력창 뒤에 붙이고 자동 전송하지 않는다(지금처럼)', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockResolvedValue('무릎이 아파요');
    api.role.mockReturnValue('GUARDIAN');
    renderChat(<ChatbotContent />);

    const textarea = page.getByRole('textbox', { name: '궁금한 점 입력' });
    await userEvent.fill(textarea, '어제부터');
    await recordFor(600);

    await expect.element(textarea).toHaveValue('어제부터 무릎이 아파요');
    expect(api.sendChatMessage).not.toHaveBeenCalled();
  });

  it('피보호자: 말한 뒤 3초 조용하면 [끝내기]를 누르지 않아도 녹음을 끝내고 보낸다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockResolvedValue('머리가 아파요');
    api.sendChatMessage.mockResolvedValue({ reply: '쉬어 보세요.', engine: 'ai', type: 'message' });
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '말로 입력하기' }));
    await expect.element(page.getByText('듣고 있어요. 말씀을 마치면 저절로 보내요.')).toBeInTheDocument();
    await sleep(700);
    setToneLevel(0);
    // 2초 무음으로는 끝내지 않는다
    await sleep(2000);
    expect(api.transcribe).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(api.transcribe).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1));
    expect(api.sendChatMessage.mock.calls[0][0].message).toBe('머리가 아파요');
  });

  it('피보호자: 녹음을 시작하고 말이 한 번도 없으면 저절로 끝내지 않는다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream(0));
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '말로 입력하기' }));
    await sleep(4000);

    expect(api.transcribe).not.toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: '녹음 끝내기' })).toBeInTheDocument();
  });

  it('지금 dev처럼 모델이 없으면(503 CHAT_STT_UNAVAILABLE) 글로 입력하라고 안내한다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockRejectedValue(sttError(503, 'CHAT_STT_UNAVAILABLE'));
    api.role.mockReturnValue('GUARDIAN');
    renderChat(<ChatbotContent />);

    await recordFor(500);

    await expect.element(page.getByText('지금은 음성을 알아듣지 못해요. 글로 입력해 주세요.')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: '말로 입력하기' })).toBeEnabled();
  });

  it('피보호자: 빈 글자가 오면 다시 말씀해 달라고 안내하고 보내지 않으며 [글자로 쓰기]를 보인다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockResolvedValue('');
    renderChat(<ChatbotContent variant="ward" />);

    await recordFor(500);

    await expect.element(page.getByText('잘 못 들었어요. 다시 말씀해 주세요.')).toBeInTheDocument();
    expect(api.sendChatMessage).not.toHaveBeenCalled();
    await expect.element(page.getByRole('button', { name: '글자로 쓰기' })).toBeVisible();
  });

  it('글자로 바꾸는 동안에는 버튼을 잠가 중복 요청을 막는다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    let resolve: (text: string) => void = () => undefined;
    api.transcribe.mockImplementation(() => new Promise<string>(r => (resolve = r)));
    api.sendChatMessage.mockResolvedValue({ reply: '네.', engine: 'ai', type: 'message' });
    renderChat(<ChatbotContent variant="ward" />);

    await recordFor(500);

    await expect.element(page.getByRole('button', { name: '말씀을 글로 바꾸는 중' })).toBeDisabled();
    await expect.element(page.getByText('말씀을 글로 바꾸는 중이에요.')).toBeInTheDocument();
    resolve('안녕하세요');
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1));
    expect(api.transcribe).toHaveBeenCalledTimes(1);
  });
});
