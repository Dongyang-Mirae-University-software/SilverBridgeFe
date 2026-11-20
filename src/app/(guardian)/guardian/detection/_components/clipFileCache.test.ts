// 이상감지 클립 파일 메모리 보관 - 다시 받지 않기·동시 요청 합치기·로그아웃 시 비우기·썸네일 양보

import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchFile = vi.hoisted(() => vi.fn());

vi.mock('@/service/api/guardian/anomaly', () => ({ fetchGuardianAnomalyClipFile: fetchFile }));

import { SESSION_CLEARED_EVENT } from '@/lib/auth/tokenStore';
import { clearClipFileCache, forgetClipFile, getCachedClipFile, loadClipFile, waitForClipDownloadsIdle } from './clipFileCache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  clearClipFileCache();
  fetchFile.mockReset();
  vi.unstubAllGlobals();
});

describe('clipFileCache', () => {
  it('한 번 받은 영상은 다시 받지 않는다', async () => {
    const blob = new Blob(['a']);
    fetchFile.mockResolvedValue(blob);

    await expect(loadClipFile(1)).resolves.toBe(blob);
    await expect(loadClipFile(1)).resolves.toBe(blob);
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it('받는 중에 같은 영상을 또 요청하면 하나로 합치고, 나중 요청도 진행률을 받는다', async () => {
    const pending = deferred<Blob>();
    let report: (received: number) => void = () => undefined;
    fetchFile.mockImplementation((_id: number, onProgress: (received: number) => void) => {
      report = onProgress;
      return pending.promise;
    });
    const first = vi.fn();
    const second = vi.fn();

    const a = loadClipFile(2, first);
    report(100);
    const b = loadClipFile(2, second);
    report(300);
    pending.resolve(new Blob(['b']));

    await Promise.all([a, b]);
    expect(fetchFile).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenLastCalledWith(300);
    expect(second).toHaveBeenCalledWith(100); // 붙는 순간 지금까지 받은 양
    expect(second).toHaveBeenLastCalledWith(300);
  });

  it('실패한 영상은 남기지 않아 다시 고르면 다시 받는다', async () => {
    fetchFile.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce(new Blob(['c']));

    await expect(loadClipFile(3)).rejects.toEqual({ status: 503 });
    await expect(loadClipFile(3)).resolves.toBeInstanceOf(Blob);
    expect(fetchFile).toHaveBeenCalledTimes(2);
  });

  it('최근 6개만 둔다', async () => {
    fetchFile.mockImplementation(async (id: number) => new Blob([String(id)]));
    for (const id of [1, 2, 3, 4, 5, 6, 7]) await loadClipFile(id);

    expect(getCachedClipFile(1)).toBeUndefined();
    expect(getCachedClipFile(7)).toBeDefined();
  });

  it('숨겨진 영상은 내리고, 로그아웃(세션 정리)하면 모두 비운다', async () => {
    vi.stubGlobal('window', new EventTarget()); // 단위 테스트는 node 환경이라 창 이벤트만 흉내 낸다
    fetchFile.mockImplementation(async (id: number) => new Blob([String(id)]));
    await loadClipFile(1);
    await loadClipFile(2);

    forgetClipFile(1);
    expect(getCachedClipFile(1)).toBeUndefined();

    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
    expect(getCachedClipFile(2)).toBeUndefined();
  });

  it('영상을 받는 동안 썸네일은 기다렸다가, 끝나면 진행한다', async () => {
    const pending = deferred<Blob>();
    fetchFile.mockReturnValue(pending.promise);
    const done = vi.fn();

    await waitForClipDownloadsIdle(); // 받는 것이 없으면 바로
    const load = loadClipFile(4);
    void waitForClipDownloadsIdle().then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();

    pending.resolve(new Blob(['d']));
    await load;
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
  });
});
