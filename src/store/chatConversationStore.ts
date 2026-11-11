import type { ChatMessage } from '@/service/interface/chat';

// 챗봇 대화를 메뉴를 오가도 이어지게 탭 저장소(sessionStorage)에 둔다(2026-11-11).
// - localStorage 는 쓰지 않는다: 앱·탭을 닫아도 남아 같은 기기의 다른 사람이 상담 내용을 볼 수 있다.
// - 탭을 닫으면 브라우저가 지우고, 로그아웃·다른 계정 로그인(clearAuthTokens·setAuthTokens)·[새 대화]에서 바로 지운다.
// - 저장소를 못 쓰면(사생활 보호 모드·용량 초과) 조용히 넘어가 지금처럼 메모리에만 둔다. 상담 내용은 로그에 남기지 않는다.
const PREFIX = 'careai_chat_conv:';
const VERSION = 1;

/** 저장하는 최근 메시지 수. 서버 맥락은 AI가 sessionId 로 따로 잇는다(화면 표시용 상한). */
export const MAX_SAVED_MESSAGES = 50;
/** 예약 선택지(ui)는 저장 뒤 이 시간이 지나면 복원하지 않는다 - AI 쪽 예약 초안과 어긋난 버튼을 누르지 않게. */
export const UI_RESTORE_TTL_MS = 10 * 60 * 1000;

const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface SavedConversation {
  sessionId: string;
  messages: ChatMessage[];
  /** 이 대화창에서 답을 받은 문장(빠른 질문에서 뺀다) */
  sent: string[];
}

interface StoredConversation extends SavedConversation {
  v: number;
  savedAt: number;
}

/** 사용자·역할·상대(보호자가 고른 피보호자, 없으면 본인 상담)마다 대화를 따로 둔다. */
export function conversationKey(role: string, userId: string, wardId?: string | null) {
  return `${PREFIX}${encodeURIComponent(userId)}:${role}:${wardId ? encodeURIComponent(wardId) : 'self'}`;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' &&
    typeof item.timestamp === 'string'
  );
}

export function saveConversation(key: string, conversation: SavedConversation, now = Date.now()) {
  const store = storage();
  if (!store || !SESSION_ID.test(conversation.sessionId)) return;
  const value: StoredConversation = {
    v: VERSION,
    savedAt: now,
    sessionId: conversation.sessionId,
    messages: conversation.messages.slice(-MAX_SAVED_MESSAGES),
    sent: conversation.sent.slice(-MAX_SAVED_MESSAGES),
  };
  try {
    store.setItem(key, JSON.stringify(value));
    return;
  } catch {
    // 용량 초과 등 - 큰 도구 데이터(병원 목록 등)를 빼고 한 번 더
  }
  try {
    const lighter = {
      ...value,
      messages: value.messages.map(message =>
        message.toolData === undefined ? message : { ...message, toolData: undefined },
      ),
    };
    store.setItem(key, JSON.stringify(lighter));
  } catch {
    // 그래도 안 되면 지운다 - 최근 턴이 빠진 옛 저장본으로 복원되는 것보다 처음부터가 낫다(2026-11-11 점검 L-2)
    removeConversation(key);
  }
}

export function loadConversation(key: string, now = Date.now()): SavedConversation | null {
  const store = storage();
  if (!store) return null;
  let parsed: unknown;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Partial<StoredConversation>;
  if (value.v !== VERSION || typeof value.sessionId !== 'string' || !SESSION_ID.test(value.sessionId)) return null;
  if (!Array.isArray(value.messages)) return null;

  const messages = value.messages.filter(isMessage);
  if (messages.length === 0) return null;
  const savedAt = typeof value.savedAt === 'number' ? value.savedAt : 0;
  const uiExpired = now - savedAt > UI_RESTORE_TTL_MS;
  return {
    sessionId: value.sessionId,
    messages: uiExpired ? messages.map(message => (message.ui ? { ...message, ui: undefined } : message)) : messages,
    sent: Array.isArray(value.sent) ? value.sent.filter((text): text is string => typeof text === 'string') : [],
  };
}

export function removeConversation(key: string) {
  try {
    storage()?.removeItem(key);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
}

/** 보호자의 피보호자별 대화 중 지금 연결 목록에 없는 피보호자의 것을 지운다(본인 상담은 남긴다, 2026-11-11 점검 L-3). */
export function pruneWardConversations(role: string, userId: string, keepWardIds: readonly string[]) {
  const store = storage();
  if (!store) return;
  try {
    const prefix = `${PREFIX}${encodeURIComponent(userId)}:${role}:`;
    const keep = new Set(keepWardIds.map(id => encodeURIComponent(id)));
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key?.startsWith(prefix)) continue;
      const target = key.slice(prefix.length);
      if (target !== 'self' && !keep.has(target)) keys.push(key);
    }
    keys.forEach(key => store.removeItem(key));
  } catch {
    // 저장소를 못 쓰면 남은 것도 없다
  }
}

/** 저장한 대화를 모두 지운다. keepUserId 를 주면 그 사용자 것은 남긴다(같은 사람의 토큰 갱신). */
export function clearConversations(keepUserId?: string | null) {
  const store = storage();
  if (!store) return;
  try {
    const keep = keepUserId ? `${PREFIX}${encodeURIComponent(keepUserId)}:` : null;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX) && !(keep && key.startsWith(keep))) keys.push(key);
    }
    keys.forEach(key => store.removeItem(key));
  } catch {
    // 저장소를 못 쓰면 남은 것도 없다
  }
}
