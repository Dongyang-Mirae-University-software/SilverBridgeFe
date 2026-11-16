import { describe, expect, it, vi } from 'vitest';

import { ensureLoggedOutPage, LOGOUT_NAV_GRACE_MS, LOGOUT_SESSION_WAIT_MS } from './logoutNavigation';

function setup(path: string) {
  const state = { path, waited: [] as number[] };
  const deps = {
    getPath: () => state.path,
    hardReplace: vi.fn((next: string) => { state.path = next; }),
    wait: vi.fn(async (ms: number) => { state.waited.push(ms); }),
  };
  return { state, deps };
}

describe('로그아웃 화면 이동 보장', () => {
  it('화면 안 이동이 되어 /login이면 새로 열지 않는다', async () => {
    const { deps } = setup('/login');
    await ensureLoggedOutPage(Promise.resolve(), deps);

    expect(deps.hardReplace).not.toHaveBeenCalled();
    expect(deps.wait).toHaveBeenCalledTimes(1);
  });

  it('예전 화면이라 이동이 안 됐으면 서버 로그아웃을 기다린 뒤 /login을 새로 연다', async () => {
    const { deps } = setup('/guardian');
    const order: string[] = [];
    const session = Promise.resolve().then(() => { order.push('session'); });
    deps.hardReplace.mockImplementation(() => { order.push('hard'); });

    await ensureLoggedOutPage(session, deps);

    expect(deps.hardReplace).toHaveBeenCalledWith('/login');
    expect(order).toEqual(['session', 'hard']);
  });

  it('서버 로그아웃이 끝나지 않아도 정해진 시간 뒤에는 새로 연다', async () => {
    const { state, deps } = setup('/admin');
    await ensureLoggedOutPage(new Promise(() => {}), deps);

    expect(state.waited).toEqual([LOGOUT_NAV_GRACE_MS, LOGOUT_SESSION_WAIT_MS]);
    expect(deps.hardReplace).toHaveBeenCalledWith('/login');
  });

  it('서버 로그아웃이 실패해도 새로 연다', async () => {
    const { deps } = setup('/ward');
    await ensureLoggedOutPage(Promise.reject(new Error('network')), deps);

    expect(deps.hardReplace).toHaveBeenCalledWith('/login');
  });

  it('기다리는 사이 /login으로 넘어갔으면 새로 열지 않는다', async () => {
    const { state, deps } = setup('/guardian');
    const session = Promise.resolve().then(() => { state.path = '/login'; });

    await ensureLoggedOutPage(session, deps);

    expect(deps.hardReplace).not.toHaveBeenCalled();
  });
});
