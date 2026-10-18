import { describe, expect, it } from 'vitest';

import { createTaskQueue } from './taskQueue';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('createTaskQueue', () => {
  it('동시에 limit개까지만 실행하고 끝나면 다음을 시작한다', async () => {
    const enqueue = createTaskQueue(2);
    let running = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const makeTask = () => () =>
      new Promise<void>(resolve => {
        running += 1;
        peak = Math.max(peak, running);
        releases.push(() => {
          running -= 1;
          resolve();
        });
      });

    const results = [enqueue(makeTask()), enqueue(makeTask()), enqueue(makeTask()), enqueue(makeTask())];
    await tick();
    expect(running).toBe(2);

    releases.shift()?.();
    await tick();
    expect(running).toBe(2);

    while (releases.length) {
      releases.shift()?.();
      await tick();
    }
    await Promise.all(results);
    expect(peak).toBe(2);
  });

  it('작업이 실패해도 다음 작업이 계속 실행된다', async () => {
    const enqueue = createTaskQueue(1);
    const failed = enqueue(() => Promise.reject(new Error('boom')));
    const ok = enqueue(() => Promise.resolve('done'));
    await expect(failed).rejects.toThrow('boom');
    await expect(ok).resolves.toBe('done');
  });
});
