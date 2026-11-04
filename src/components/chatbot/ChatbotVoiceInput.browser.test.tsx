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
vi.mock('@/lib/auth/tokenStore', () => ({ getAuthRole: api.role }));
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

// 말소리 대신 440Hz 소리를 내는 스트림
let toneContext: AudioContext | null = null;
let toneTracks: MediaStreamTrack[] = [];
function fakeMicStream() {
  toneContext = new AudioContext();
  const oscillator = toneContext.createOscillator();
  const destination = toneContext.createMediaStreamDestination();
  oscillator.connect(destination);
  oscillator.start();
  toneTracks = destination.stream.getTracks();
  return destination.stream;
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

describe('챗봇 마이크 음성 입력', () => {
  it('피보호자·보호자 화면 모두 마이크 버튼이 보인다', async () => {
    renderChat(<ChatbotContent variant="ward" />);
    await expect.element(page.getByRole('button', { name: '말로 입력하기' })).toBeInTheDocument();
  });

  it('권한을 거부하면 안내만 하고 서버를 부르지 않는다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    renderChat(<ChatbotContent variant="ward" />);

    await userEvent.click(page.getByRole('button', { name: '말로 입력하기' }));

    await expect.element(page.getByText('마이크 권한을 허용해 주세요.')).toBeInTheDocument();
    expect(api.transcribe).not.toHaveBeenCalled();
  });

  it('녹음을 끝내면 16kHz WAV를 올리고 받은 글자를 입력창 뒤에 붙인다 - 자동 전송하지 않는다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockResolvedValue('무릎이 아파요');
    renderChat(<ChatbotContent variant="ward" />);

    const textarea = page.getByRole('textbox', { name: '궁금한 점 입력' });
    await userEvent.fill(textarea, '어제부터');
    await recordFor(600);

    await expect.element(textarea).toHaveValue('어제부터 무릎이 아파요');
    expect(api.sendChatMessage).not.toHaveBeenCalled();

    const blob = api.transcribe.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('audio/wav');
    const view = new DataView(await blob.arrayBuffer());
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(22, true)).toBe(1);
    // 녹음이 끝나면 마이크 트랙을 끈다
    expect(toneTracks.every(track => track.readyState === 'ended')).toBe(true);
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

  it('빈 글자가 오면 다시 말씀해 달라고 안내하고 입력창은 그대로 둔다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    api.transcribe.mockResolvedValue('');
    renderChat(<ChatbotContent variant="ward" />);

    await recordFor(500);

    await expect.element(page.getByText('잘 못 들었어요. 다시 말씀해 주세요.')).toBeInTheDocument();
    await expect.element(page.getByRole('textbox', { name: '궁금한 점 입력' })).toHaveValue('');
  });

  it('글자로 바꾸는 동안에는 버튼을 잠가 중복 요청을 막는다', async () => {
    getUserMedia.mockImplementation(async () => fakeMicStream());
    let resolve: (text: string) => void = () => undefined;
    api.transcribe.mockImplementation(() => new Promise<string>(r => (resolve = r)));
    renderChat(<ChatbotContent variant="ward" />);

    await recordFor(500);

    await expect.element(page.getByRole('button', { name: '말씀을 글로 바꾸는 중' })).toBeDisabled();
    resolve('안녕하세요');
    await expect.element(page.getByRole('textbox', { name: '궁금한 점 입력' })).toHaveValue('안녕하세요');
    expect(api.transcribe).toHaveBeenCalledTimes(1);
  });
});
