// 실시간 연결 끊김 안내(QA AUTH-A54). 실제 Chrome에서 돈다
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { act } from 'react';

const store = vi.hoisted(() => {
  let status = 'idle';
  const listeners = new Set<() => void>();
  return {
    set: (next: string) => {
      status = next;
      listeners.forEach(listener => listener());
    },
    getRealtimeStatus: () => status,
    subscribeRealtimeStatus: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
vi.mock('@/lib/realtime/connectionSocket', () => store);

import { RealtimeStatusBanner } from './RealtimeStatusBanner';

afterEach(() => {
  document.body.innerHTML = '';
  store.set('idle');
});

describe('실시간 연결 끊김 안내 (Chrome)', () => {
  it('끊겨 다시 붙는 동안만 안내를 보이고, 다시 붙으면 사라진다', async () => {
    await render(<RealtimeStatusBanner />);
    expect(page.getByRole('status').query()).toBeNull();

    await act(async () => store.set('reconnecting'));
    await expect.element(page.getByRole('status')).toHaveTextContent('실시간 연결이 끊겼어요. 다시 연결하는 중이에요.');

    await act(async () => store.set('connected'));
    expect(page.getByRole('status').query()).toBeNull();
  });
});
