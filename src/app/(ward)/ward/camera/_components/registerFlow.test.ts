import { describe, expect, it, vi } from 'vitest';

import { registerAndStart } from './registerFlow';

type Camera = { deviceId: string };

function setup(overrides: Partial<Parameters<typeof registerAndStart<Camera>>[0]> = {}) {
  const calls: string[] = [];
  const deps = {
    register: vi.fn(async () => {
      calls.push('register');
      return { deviceId: 'dev-1' } as Camera;
    }),
    onRegistered: vi.fn(() => calls.push('saveDevice')),
    start: vi.fn(async () => {
      calls.push('start');
    }),
    onStarted: vi.fn(() => calls.push('close')),
    ...overrides,
  };
  return { deps, calls };
}

describe('registerAndStart', () => {
  it('등록 성공 → 기기 저장 → 송출 시작 → 창 닫기 순서로 진행한다', async () => {
    const { deps, calls } = setup();
    await expect(registerAndStart(deps)).resolves.toEqual({ kind: 'started' });
    expect(calls).toEqual(['register', 'saveDevice', 'start', 'close']);
    expect(deps.start).toHaveBeenCalledWith({ deviceId: 'dev-1' });
  });

  it('송출 시작이 실패하면 창을 닫지 않고 그 자리에서 안내하게 한다', async () => {
    const { deps } = setup({ start: vi.fn(async () => Promise.reject(new Error('network'))) });
    await expect(registerAndStart(deps)).resolves.toEqual({ kind: 'startFailed' });
    expect(deps.onRegistered).toHaveBeenCalled();
    expect(deps.onStarted).not.toHaveBeenCalled();
  });

  it('등록이 실패하면 송출도 닫기도 하지 않고 오류를 돌려준다', async () => {
    const error = { response: { data: { code: 'CAMERA_LABEL_DUPLICATED' } } };
    const { deps } = setup({ register: vi.fn(async () => Promise.reject(error)) });
    await expect(registerAndStart(deps)).resolves.toEqual({ kind: 'registerFailed', error });
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.onStarted).not.toHaveBeenCalled();
  });

  it('등록 응답이 비어 있으면 실패로 본다', async () => {
    const { deps } = setup({ register: vi.fn(async () => undefined) });
    await expect(registerAndStart(deps)).resolves.toMatchObject({ kind: 'registerFailed' });
    expect(deps.start).not.toHaveBeenCalled();
  });
});
