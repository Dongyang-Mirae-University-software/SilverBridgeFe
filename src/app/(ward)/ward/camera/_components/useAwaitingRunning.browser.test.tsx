// 송출 시작 뒤 'running' 대기 표시 - lint 정리(2026-11-19)로 effect 를 렌더 중 비교로 바꾸며 동작이 그대로인지 고정한다

import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { WardLiveCamera } from '@/service/interface/ward/camera';
import { AWAIT_RUNNING_MS } from './cameraAction';
import { useAwaitingRunning } from './WardCameraStreamProvider';

// 공급자 모듈이 끌어오는 등록 모달은 이 훅과 무관하다
vi.mock('./CameraRegisterModal', () => ({ CameraRegisterModal: () => null }));

type Status = WardLiveCamera['status'] | undefined;
const api: { awaiting: boolean; set: (value: boolean) => void } = { awaiting: false, set: () => {} };

function Probe({ status }: { status: Status }) {
  const [awaiting, set] = useAwaitingRunning(status);
  useEffect(() => {
    api.awaiting = awaiting;
    api.set = set;
  });
  return <output>{String(awaiting)}</output>;
}

describe('useAwaitingRunning', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("상태가 'running'으로 바뀌는 순간 기다림을 끝낸다", async () => {
    const screen = await render(<Probe status={undefined} />);
    api.set(true);
    await expect.element(screen.getByText('true')).toBeInTheDocument();

    await screen.rerender(<Probe status="running" />);
    await expect.element(screen.getByText('false')).toBeInTheDocument();
  });

  it("이미 running 인 카메라를 다시 켜면 바로 지우지 않고, 다른 상태를 거쳐 running 이 될 때 끝낸다", async () => {
    const screen = await render(<Probe status="running" />);
    api.set(true);
    await expect.element(screen.getByText('true')).toBeInTheDocument();

    await screen.rerender(<Probe status="running" />);
    expect(api.awaiting).toBe(true);
    await screen.rerender(<Probe status="disconnected" />);
    expect(api.awaiting).toBe(true);
    await screen.rerender(<Probe status="running" />);
    await expect.element(screen.getByText('false')).toBeInTheDocument();
  });

  it(`${AWAIT_RUNNING_MS / 1000}초가 지나면 기다림을 끝낸다`, async () => {
    vi.useFakeTimers();
    const screen = await render(<Probe status={undefined} />);
    api.set(true);
    await vi.waitFor(() => expect(api.awaiting).toBe(true));
    vi.advanceTimersByTime(AWAIT_RUNNING_MS - 1);
    expect(api.awaiting).toBe(true);
    vi.advanceTimersByTime(1);
    await vi.waitFor(() => expect(api.awaiting).toBe(false));
    expect(screen.container.textContent).toBe('false');
  });
});
