// 피보호자 카메라 등록 창 4단계(미리보기) 테스트 - 실제 Chrome(375px)에서 돈다(`npm run test:browser`)
// 화면 선택·카메라 권한 창과 서버 응답은 가짜로 바꾸고, 버튼 문구·오류 안내 위치·등록 호출만 본다

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { WardCamera } from '@/service/interface/ward/camera';
import { CameraRegisterModal } from './CameraRegisterModal';

const api = vi.hoisted(() => ({
  getWardCameraRooms: vi.fn(),
  registerWardCamera: vi.fn(),
  getWardCameras: vi.fn(),
  getWardLiveCameras: vi.fn(),
}));

const streamApi = vi.hoisted(() => ({
  createStreamSession: vi.fn(),
  uploadFrame: vi.fn(),
  stopStreamSession: vi.fn(),
}));

vi.mock('@/service/api/ward/camera', async importOriginal => ({
  ...(await importOriginal<object>()),
  ...api,
}));
vi.mock('@/service/api/streamSession', () => streamApi);
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

// 송출 타이머 워커는 이 테스트에서 돌릴 필요가 없다(업로드 루프를 멈춰 둔다)
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage() {}
  terminate() {}
}

const camera: WardCamera = {
  id: 7,
  sessionId: 'ward_abcdefghijklmnop',
  deviceId: 'device-1',
  label: '거실',
  isActive: true,
  recommendedFps: 10,
  createdAt: '2026-10-26T20:30:00+09:00',
};

// 실제 영상 트랙이 있는 스트림 - 미리보기(canvas)가 그릴 수 있어야 '등록하고 촬영 시작'이 열린다
function fakeStream() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 36;
  canvas.getContext('2d')?.fillRect(0, 0, 64, 36);
  return canvas.captureStream(5);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const getUserMedia = vi.fn();
const getDisplayMedia = vi.fn();

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  Object.values(streamApi).forEach(mock => mock.mockReset());
  getUserMedia.mockReset();
  getDisplayMedia.mockReset();
  api.getWardCameraRooms.mockResolvedValue([
    { label: '거실', registered: false },
    { label: '침실', registered: false },
  ]);
  api.getWardCameras.mockResolvedValue([]);
  api.getWardLiveCameras.mockResolvedValue([]);
  streamApi.createStreamSession.mockResolvedValue({ session_id: camera.sessionId });
  streamApi.uploadFrame.mockResolvedValue(undefined);
  streamApi.stopStreamSession.mockResolvedValue(undefined);
  vi.stubGlobal('Worker', FakeWorker);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, getDisplayMedia },
  });
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

type Screen = ReturnType<typeof render>;

// 1~3단계를 지나 4단계(미리보기)에 들어간다
async function goToPreview(screen: Screen, facingLabel: string) {
  await screen.getByRole('button', { name: '거실' }).click();
  await screen.getByRole('button', { name: '다음' }).click();
  await screen.getByRole('button', { name: '이렇게 놓았어요' }).click();
  await screen.getByRole('radio', { name: new RegExp(facingLabel) }).click();
  await screen.getByRole('button', { name: '다음' }).click();
}

describe('카메라 등록 4단계 (Chrome)', () => {
  it('화면을 고르는 동안에는 "카메라 다시 켜기"가 아니라 비활성 "화면을 고르는 중..."이 보인다', async () => {
    const picker = deferred<MediaStream>();
    getDisplayMedia.mockReturnValue(picker.promise);
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '^화면');

    const pending = screen.getByRole('button', { name: '화면을 고르는 중...' });
    await expect.element(pending).toBeDisabled();
    expect(screen.getByRole('button', { name: '카메라 다시 켜기' }).query()).toBeNull();
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);

    picker.resolve(fakeStream());
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
  });

  it('카메라를 켜는 동안에는 비활성 "카메라를 켜는 중..."이 보인다', async () => {
    const permission = deferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '전면 카메라');

    await expect.element(screen.getByRole('button', { name: '카메라를 켜는 중...' })).toBeDisabled();
    permission.resolve(fakeStream());
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
  });

  it('화면 선택을 취소하면 "카메라 다시 켜기"와 권한 안내가 보이고, 누르면 다시 고른다', async () => {
    getDisplayMedia.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '^화면');

    const retry = screen.getByRole('button', { name: '카메라 다시 켜기' });
    await expect.element(retry).toBeEnabled();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('카메라를 켜지 못했어요');

    getDisplayMedia.mockResolvedValueOnce(fakeStream());
    await retry.click();
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
    expect(getDisplayMedia).toHaveBeenCalledTimes(2);
  });

  it('서비스 카메라 상한(409 CAMERA_LIMIT_REACHED)이면 버튼 바로 위에 전용 안내가 보인다', async () => {
    getUserMedia.mockResolvedValue(fakeStream());
    api.registerWardCamera.mockRejectedValue(
      Object.assign(new Error('현재 서비스에서 등록할 수 있는 카메라를 모두 사용했습니다.'), {
        response: { status: 409, data: { code: 'CAMERA_LIMIT_REACHED' } },
      }),
    );
    const onClose = vi.fn();
    const screen = render(<CameraRegisterModal isOpen onClose={onClose} />, { wrapper });

    await goToPreview(screen, '전면 카메라');
    await screen.getByRole('button', { name: '등록하고 촬영 시작' }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert).toHaveTextContent(
      '지금은 카메라를 더 등록할 수 없어요. 쓰지 않는 카메라를 등록 해제한 뒤 다시 시도해 주세요.',
    );
    // 스크롤하지 않아도 화면 안에 보인다
    const rect = alert.element().getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    // 스크롤 영역(영상·요약) 안이 아니라 버튼 줄 바로 위에 있다
    const footer = alert.element().nextElementSibling;
    expect(footer?.tagName).toBe('FOOTER');
    expect(alert.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(footer!.getBoundingClientRect().top);
    expect(onClose).not.toHaveBeenCalled();
    expect(api.registerWardCamera).toHaveBeenCalledTimes(1);
    // 같은 방에서 다시 시도할 수 있게 4단계와 미리보기는 그대로 둔다
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
  });

  it('등록에 성공하면 등록 요청 1회 뒤 송출을 시작하고 창을 닫는다', async () => {
    getUserMedia.mockResolvedValue(fakeStream());
    api.registerWardCamera.mockResolvedValue(camera);
    const onClose = vi.fn();
    const screen = render(<CameraRegisterModal isOpen onClose={onClose} />, { wrapper });

    await goToPreview(screen, '전면 카메라');
    await screen.getByRole('button', { name: '등록하고 촬영 시작' }).click();

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.registerWardCamera).toHaveBeenCalledTimes(1);
    expect(api.registerWardCamera.mock.calls[0]?.[0]).toMatchObject({ label: '거실' });
    expect(streamApi.createStreamSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').query()).toBeNull();
  });
});
