// 보호자가 고른 피보호자 전역 저장소 - 화면을 옮기거나 새로고침해도 이어지고, 로그아웃하면 지운다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'careai_selected_ward_id';

function installSessionStorage() {
  const items = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
    removeItem: vi.fn((key: string) => void items.delete(key)),
  };
  vi.stubGlobal('window', { sessionStorage: storage });
  return { items, storage };
}

// 모듈 안 메모리 값을 테스트마다 새로 시작한다(새로고침 = 모듈을 다시 읽음)
async function loadStore() {
  vi.resetModules();
  return import('./selectedWardStore');
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selectedWardStore', () => {
  it('고른 피보호자를 탭 저장소에 남긴다(새로고침 뒤 첫 읽기에서 꺼낸다)', async () => {
    const { items } = installSessionStorage();
    const store = await loadStore();
    store.setSelectedWardId('ward-2');
    expect(items.get(STORAGE_KEY)).toBe('ward-2');
  });

  it('지우면 저장소에서도 지운다', async () => {
    const { items } = installSessionStorage();
    const store = await loadStore();
    store.setSelectedWardId('ward-2');
    store.clearSelectedWardId();
    expect(items.has(STORAGE_KEY)).toBe(false);
  });

  it('저장소를 쓸 수 없어도(사생활 보호 모드) 예외 없이 메모리에만 둔다', async () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
        removeItem: () => {
          throw new Error('denied');
        },
      },
    });
    const store = await loadStore();
    expect(() => store.setSelectedWardId('ward-2')).not.toThrow();
    expect(() => store.clearSelectedWardId()).not.toThrow();
  });

  it('브라우저가 아닌 곳(서버 렌더)에서 불러도 예외가 없다', async () => {
    const store = await loadStore();
    expect(() => store.clearSelectedWardId()).not.toThrow();
  });
});

describe('로그아웃(clearAuthTokens)', () => {
  it('앞 사람이 고른 피보호자를 지운다', async () => {
    const { items } = installSessionStorage();
    vi.resetModules();
    const store = await import('./selectedWardStore');
    const { clearAuthTokens } = await import('@/lib/auth/tokenStore');
    vi.stubGlobal('document', { cookie: '' });

    store.setSelectedWardId('ward-2');
    clearAuthTokens();

    expect(items.has(STORAGE_KEY)).toBe(false);
  });
});
