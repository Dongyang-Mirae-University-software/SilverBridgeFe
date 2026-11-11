import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/service/interface/chat';
import {
  MAX_SAVED_MESSAGES,
  UI_RESTORE_TTL_MS,
  clearConversations,
  conversationKey,
  loadConversation,
  pruneWardConversations,
  removeConversation,
  saveConversation,
} from './chatConversationStore';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function msg(id: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, role: 'user', content: id, timestamp: '2026-11-11T00:00:00Z', ...extra };
}

let storage: Storage;
beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('window', { sessionStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('챗봇 대화 탭 저장소 (2026-11-11)', () => {
  const key = conversationKey('GUARDIAN', 'guardian-1', 'ward-1');

  it('사용자·역할·피보호자마다 키가 다르다', () => {
    expect(key).not.toBe(conversationKey('GUARDIAN', 'guardian-1', 'ward-2'));
    expect(key).not.toBe(conversationKey('GUARDIAN', 'guardian-1'));
    expect(key).not.toBe(conversationKey('GUARDIAN', 'guardian-2', 'ward-1'));
  });

  it('저장한 대화·sessionId·보낸 문장을 그대로 불러온다', () => {
    saveConversation(key, { sessionId: 'abc-1', messages: [msg('a'), msg('b')], sent: ['a'] });
    expect(loadConversation(key)).toEqual({ sessionId: 'abc-1', messages: [msg('a'), msg('b')], sent: ['a'] });
  });

  it(`최근 ${MAX_SAVED_MESSAGES}개만 남긴다`, () => {
    const many = Array.from({ length: MAX_SAVED_MESSAGES + 5 }, (_, i) => msg(`m${i}`));
    saveConversation(key, { sessionId: 'abc', messages: many, sent: [] });
    const loaded = loadConversation(key)!;
    expect(loaded.messages).toHaveLength(MAX_SAVED_MESSAGES);
    expect(loaded.messages[0].id).toBe('m5');
  });

  it('저장 뒤 시간이 지난 예약 선택지(ui)는 숨기고, 금방이면 남긴다', () => {
    const ui = { kind: 'select' as const, field: 'date', options: ['2026-11-12'] };
    saveConversation(key, { sessionId: 'abc', messages: [msg('a', { role: 'assistant', ui })], sent: [] }, 1_000);
    expect(loadConversation(key, 1_000 + 60_000)!.messages[0].ui).toEqual(ui);
    expect(loadConversation(key, 1_000 + UI_RESTORE_TTL_MS + 1)!.messages[0].ui).toBeUndefined();
  });

  it('형식이 틀린 값·sessionId 는 불러오지 않는다', () => {
    storage.setItem(key, '{not json');
    expect(loadConversation(key)).toBeNull();
    storage.setItem(key, JSON.stringify({ v: 1, savedAt: 0, sessionId: 'bad id!', messages: [msg('a')], sent: [] }));
    expect(loadConversation(key)).toBeNull();
    storage.setItem(key, JSON.stringify({ v: 1, savedAt: 0, sessionId: 'ok', messages: [{ id: 1 }], sent: [] }));
    expect(loadConversation(key)).toBeNull();
  });

  it('저장소가 오류를 내도 예외를 던지지 않는다', () => {
    const broken = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    vi.stubGlobal('window', { sessionStorage: broken });
    expect(() => saveConversation(key, { sessionId: 'abc', messages: [msg('a')], sent: [] })).not.toThrow();
    expect(loadConversation(key)).toBeNull();
    expect(() => clearConversations()).not.toThrow();
  });

  it('removeConversation 은 그 대화만, clearConversations 는 전부(또는 남길 사용자 빼고) 지우고 다른 키는 건드리지 않는다', () => {
    const other = conversationKey('GUARDIAN', 'guardian-1', 'ward-2');
    const someoneElse = conversationKey('WARD', 'ward-9');
    for (const k of [key, other, someoneElse])
      saveConversation(k, { sessionId: 'abc', messages: [msg('a')], sent: [] });
    storage.setItem('careai_selected_ward_id', 'ward-1');

    removeConversation(key);
    expect(loadConversation(key)).toBeNull();
    expect(loadConversation(other)).not.toBeNull();

    clearConversations('guardian-1');
    expect(loadConversation(other)).not.toBeNull();
    expect(loadConversation(someoneElse)).toBeNull();

    clearConversations();
    expect(loadConversation(other)).toBeNull();
    expect(storage.getItem('careai_selected_ward_id')).toBe('ward-1');
  });

  it('용량이 넘치면 도구 데이터를 빼고 다시 저장하고, 그래도 안 되면 옛 저장본을 지운다 (점검 L-2)', () => {
    const base = fakeStorage();
    let limit = Infinity;
    const limited: Storage = {
      ...base,
      get length() {
        return base.length;
      },
      setItem: (k: string, v: string) => {
        if (v.length > limit) throw new DOMException('full', 'QuotaExceededError');
        base.setItem(k, v);
      },
    };
    vi.stubGlobal('window', { sessionStorage: limited });
    const big = { hospitals: 'x'.repeat(5000) };
    saveConversation(key, { sessionId: 'abc', messages: [msg('old')], sent: [] });

    limit = 2000;
    saveConversation(key, {
      sessionId: 'abc',
      messages: [msg('a', { role: 'assistant', toolData: big }), msg('b')],
      sent: [],
    });
    const lighter = loadConversation(key)!;
    expect(lighter.messages.map(m => m.id)).toEqual(['a', 'b']);
    expect(lighter.messages[0].toolData).toBeUndefined();

    limit = 10;
    saveConversation(key, { sessionId: 'abc', messages: [msg('c')], sent: [] });
    expect(loadConversation(key)).toBeNull();
  });

  it('연결 목록에 없는 피보호자의 대화만 지우고 본인 상담·다른 사람·다른 역할은 남긴다 (점검 L-3)', () => {
    const keepWard = conversationKey('GUARDIAN', 'guardian-1', 'ward-1');
    const gone = conversationKey('GUARDIAN', 'guardian-1', 'ward-9');
    const self = conversationKey('GUARDIAN', 'guardian-1');
    const other = conversationKey('GUARDIAN', 'guardian-2', 'ward-9');
    for (const k of [keepWard, gone, self, other])
      saveConversation(k, { sessionId: 'abc', messages: [msg('a')], sent: [] });

    pruneWardConversations('GUARDIAN', 'guardian-1', ['ward-1']);
    expect(loadConversation(keepWard)).not.toBeNull();
    expect(loadConversation(gone)).toBeNull();
    expect(loadConversation(self)).not.toBeNull();
    expect(loadConversation(other)).not.toBeNull();

    pruneWardConversations('GUARDIAN', 'guardian-1', []);
    expect(loadConversation(keepWard)).toBeNull();
    expect(loadConversation(self)).not.toBeNull();
  });
});
