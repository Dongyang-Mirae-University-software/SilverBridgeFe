import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// public/firebase-messaging-sw.js 를 가짜 서비스 워커 환경에서 그대로 실행해 연결을 고정한다.
// 깨지면 "알림 두 번 표시"·"눌러도 아무 화면도 안 열림"이 조용히 돌아온다(2026-10-30 점검 M-2)
const PUBLIC_DIR = new URL('../../../public/', import.meta.url).pathname;
const SW_SOURCE = readFileSync(`${PUBLIC_DIR}firebase-messaging-sw.js`, 'utf8');
const LOGIC_SOURCE = readFileSync(`${PUBLIC_DIR}push-sw-logic.js`, 'utf8');

type Listener = (event: unknown) => void;

function loadServiceWorker({ windows = [] as { url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }[] } = {}) {
  const order: string[] = [];
  const listeners: Record<string, Listener> = {};
  let backgroundHandler: ((payload: unknown) => Promise<void>) | null = null;
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);

  const self = {
    location: { origin: 'https://example.com' },
    registration: { showNotification },
    clients: { matchAll: async () => windows, openWindow },
    addEventListener: (type: string, listener: Listener) => {
      order.push(`listener:${type}`);
      listeners[type] = listener;
    },
  } as Record<string, unknown>;

  const context: Record<string, unknown> = {
    self,
    URL,
    atob,
    importScripts: (url: string) => {
      if (url === '/push-sw-logic.js') runInNewContext(LOGIC_SOURCE, context);
    },
    firebase: {
      initializeApp: () => order.push('initializeApp'),
      messaging: () => {
        order.push('messaging');
        return { onBackgroundMessage: (handler: typeof backgroundHandler) => (backgroundHandler = handler) };
      },
    },
  };
  runInNewContext(SW_SOURCE, context);

  return { order, listeners, showNotification, openWindow, background: (payload: unknown) => backgroundHandler!(payload) };
}

async function click(listener: Listener, data: unknown, action = '') {
  let pending: Promise<unknown> = Promise.resolve();
  const event = {
    action,
    notification: { data, close: vi.fn() },
    stopImmediatePropagation: vi.fn(),
    waitUntil: (promise: Promise<unknown>) => (pending = promise),
  };
  listener(event);
  await pending;
  return event;
}

describe('서비스 워커 연결', () => {
  it('클릭 리스너를 firebase.messaging()보다 먼저 등록한다 - 라이브러리 리스너가 FCM_MSG 클릭을 가로채지 못하게', () => {
    const { order } = loadServiceWorker();
    expect(order.indexOf('listener:notificationclick')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('listener:notificationclick')).toBeLessThan(order.indexOf('messaging'));
  });

  it('notification 블록이 있으면 그리지 않는다(라이브러리가 이미 띄움)', async () => {
    const sw = loadServiceWorker();
    await sw.background({ notification: { title: 'x' }, data: { type: 'WARD_SOS', title: 'x' } });
    expect(sw.showNotification).not.toHaveBeenCalled();
  });

  it('data만 오면 정확히 한 번 그린다', async () => {
    const sw = loadServiceWorker();
    await sw.background({ data: { type: 'CONNECTION_FORCED', connectionId: '9', title: '실버브릿지', body: '첫 줄\n둘째 줄' } });
    expect(sw.showNotification).toHaveBeenCalledTimes(1);
    expect(sw.showNotification).toHaveBeenCalledWith(
      '실버브릿지',
      expect.objectContaining({ body: '첫 줄\n둘째 줄', icon: '/icons/push/icon-connection.png', tag: 'CONNECTION_FORCED:9' }),
    );
  });

  it('라이브러리가 띄운 알림(FCM_MSG)을 눌러도 종류별 화면을 연다', async () => {
    const sw = loadServiceWorker();
    const event = await click(sw.listeners.notificationclick, { FCM_MSG: { data: { type: 'MEDICATION_REMINDER' } } });
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    expect(sw.openWindow).toHaveBeenCalledWith('https://example.com/ward/medication');
  });

  it('열린 탭은 포커스가 거부돼도 그 탭에서 이동한다', async () => {
    const navigate = vi.fn(async () => null);
    const sw = loadServiceWorker({
      windows: [{ url: 'https://example.com/guardian', focus: () => Promise.reject(new Error('not allowed')), navigate }],
    });
    await click(sw.listeners.notificationclick, { type: 'WARD_SOS' }, 'family-contacts');
    expect(navigate).toHaveBeenCalledWith('https://example.com/guardian/wards');
    expect(sw.openWindow).not.toHaveBeenCalled();
  });
});
