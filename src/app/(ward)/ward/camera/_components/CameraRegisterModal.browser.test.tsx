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

  // 점검 M-1: 화면 선택 창이 떠 있는 동안 창을 닫으면, 나중에 고른 화면이 숨은 창에서 켜진 채 남지 않는다
  it('화면 선택 중 창을 닫고 나중에 고르면 받은 화면을 끄고, 다시 열면 1단계부터 시작한다', async () => {
    const picker = deferred<MediaStream>();
    getDisplayMedia.mockReturnValue(picker.promise);
    const onClose = vi.fn();
    const screen = render(<CameraRegisterModal isOpen onClose={onClose} />, { wrapper });

    await goToPreview(screen, '^화면');
    await screen.getByRole('button', { name: '닫기' }).first().click();
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.rerender(<CameraRegisterModal isOpen={false} onClose={onClose} />);

    const stream = fakeStream();
    picker.resolve(stream);
    await vi.waitFor(() => expect(stream.getVideoTracks()[0].readyState).toBe('ended'));

    screen.rerender(<CameraRegisterModal isOpen onClose={onClose} />);
    await expect.element(screen.getByRole('button', { name: '거실' })).toBeVisible();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toBe('1. 방 고르기');
    expect(screen.getByRole('alert').query()).toBeNull();
  });

  it('화면 선택 중 이전으로 가고 나중에 고르면 받은 화면을 끄고, 3단계 촬영 방식을 다시 고를 수 있다', async () => {
    const picker = deferred<MediaStream>();
    getDisplayMedia.mockReturnValue(picker.promise);
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '^화면');
    await screen.getByRole('button', { name: '이전' }).click();
    const stream = fakeStream();
    picker.resolve(stream);
    await vi.waitFor(() => expect(stream.getVideoTracks()[0].readyState).toBe('ended'));

    const frontCamera = screen.getByRole('radio', { name: /^전면 카메라/ });
    await expect.element(frontCamera).toBeEnabled();
    expect(screen.getByRole('alert').query()).toBeNull();

    // 방식을 바꿔 다시 4단계로 가면 새 방식으로 켠다
    getUserMedia.mockResolvedValue(fakeStream());
    await frontCamera.click();
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('지난번 화면 선택이 끝나기 전에 4단계로 돌아오면, 그 결과가 끝난 뒤 이어서 미리보기를 보인다', async () => {
    const picker = deferred<MediaStream>();
    getDisplayMedia.mockReturnValueOnce(picker.promise);
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '^화면');
    await screen.getByRole('button', { name: '이전' }).click();
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByRole('button', { name: '화면을 고르는 중...' })).toBeDisabled();

    picker.resolve(fakeStream());
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it('이전으로 갔다가 다시 4단계로 오면 카메라를 다시 켠다', async () => {
    getUserMedia.mockImplementation(async () => fakeStream());
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '전면 카메라');
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
    await screen.getByRole('button', { name: '이전' }).click();
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  // 점검 L-1: 송출 전 미리보기에서 공유를 끊으면 끊긴 화면으로 등록하지 않게 한다
  it('미리보기 중 화면 공유가 끊기면 "카메라 다시 켜기"와 안내가 보인다', async () => {
    const stream = fakeStream();
    getDisplayMedia.mockResolvedValue(stream);
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '^화면');
    await expect.element(screen.getByRole('button', { name: '등록하고 촬영 시작' })).toBeEnabled();
    stream.getVideoTracks()[0].dispatchEvent(new Event('ended'));

    await expect.element(screen.getByRole('button', { name: '카메라 다시 켜기' })).toBeEnabled();
    await expect.element(screen.getByRole('alert')).toHaveTextContent('미리보기가 끊겼어요. 다시 켜 주세요.');
  });

  it('방 중복(409 CAMERA_LABEL_DUPLICATED)이면 1단계로 돌아가고 안내가 버튼 바로 위에 보인다', async () => {
    getUserMedia.mockResolvedValue(fakeStream());
    api.registerWardCamera.mockRejectedValue(
      Object.assign(new Error('같은 방에 이미 등록된 카메라가 있습니다.'), {
        response: { status: 409, data: { code: 'CAMERA_LABEL_DUPLICATED' } },
      }),
    );
    const screen = render(<CameraRegisterModal isOpen onClose={() => {}} />, { wrapper });

    await goToPreview(screen, '전면 카메라');
    await screen.getByRole('button', { name: '등록하고 촬영 시작' }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert).toHaveTextContent('방금 다른 기기에서 그 방을 등록했어요. 다른 방을 골라 주세요.');
    expect(document.querySelector('[aria-current="step"]')?.textContent).toBe('1. 방 고르기');
    expect(alert.element().nextElementSibling?.tagName).toBe('FOOTER');
    await vi.waitFor(() => expect(api.getWardCameraRooms.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('기존 카메라의 "카메라 켜기"가 실패해도 안내가 버튼 바로 위, 화면 안에 보인다', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const screen = render(<CameraRegisterModal isOpen initialRoom="거실" onClose={() => {}} />, { wrapper });

    await screen.getByRole('button', { name: '카메라 켜기' }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert).toHaveTextContent('카메라를 켜지 못했어요');
    expect(alert.element().nextElementSibling?.tagName).toBe('FOOTER');
    const rect = alert.element().getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
