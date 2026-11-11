import type { ChatLogItem, ChatMessage, ChatRiskLevel } from '@/service/interface/chat';
import { selectionText } from './reservationFlow';

// 상담 기록(기록 1건 = 질문 1개와 답 1개)을 대화창(sessionId) 단위로 묶는다(2026-11-11).
// AI 기록 목록은 본인 기록 전부를 최신순으로 준다 - 한 대화창의 질문·답은 FE에서 모아 시간순으로 다시 놓는다.
// 보호자의 피보호자 구분은 기록에 wardId 칸이 생긴 뒤에 붙인다(지금 목록 응답에 없음).

export interface ChatHistorySession {
  key: string;
  /** 시간순(오래된 것 먼저) */
  logs: ChatLogItem[];
  startedAt?: string;
  lastAt?: string;
  /** 목록에 보일 첫 질문(선택지 턴은 건너뛴다) */
  title: string;
}

const SELECTION = /^\s*\[선택\]\s*/;
// 값이 ID라 그대로 보이면 뜻이 없는 칸
const ID_FIELDS = new Set(['hospital', 'reservation_id', 'reservation_change_pick', 'reservation_cancel_pick']);

export function isSelectionLog(message?: string) {
  return SELECTION.test(message ?? '');
}

function time(log: ChatLogItem) {
  const value = log.createdAt ? Date.parse(log.createdAt) : Number.NaN;
  return Number.isNaN(value) ? null : value;
}

function compareLogs(a: ChatLogItem, b: ChatLogItem) {
  const ta = time(a);
  const tb = time(b);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  // 같은 시각·시각 없음은 id(저장 순서)로
  const ia = Number(a.id);
  const ib = Number(b.id);
  if (Number.isFinite(ia) && Number.isFinite(ib)) return ia - ib;
  return 0;
}

/** 선택지 턴("[선택] field: value")은 고른 값만, 날짜는 읽기 좋게, ID 값은 "선택했어요"로 보인다. */
export function userTextOf(message?: string) {
  const text = message ?? '';
  if (!isSelectionLog(text)) return text;
  const rest = text.replace(SELECTION, '');
  const at = rest.indexOf(':');
  const field = at >= 0 ? rest.slice(0, at).trim() : '';
  const value = (at >= 0 ? rest.slice(at + 1) : rest).trim();
  if (!value || ID_FIELDS.has(field)) return '선택했어요';
  return selectionText(value);
}

export function groupChatSessions(logs: unknown): ChatHistorySession[] {
  if (!Array.isArray(logs)) return [];
  const groups = new Map<string, ChatLogItem[]>();
  (logs as ChatLogItem[]).forEach((log, index) => {
    if (!log || typeof log !== 'object') return;
    // sessionId 가 없는 옛 기록은 한 건씩 따로 둔다
    const key = typeof log.sessionId === 'string' && log.sessionId ? `s:${log.sessionId}` : `l:${log.id ?? index}`;
    const list = groups.get(key);
    if (list) list.push(log);
    else groups.set(key, [log]);
  });

  const sessions = [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort(compareLogs);
    const first = sorted.find(log => !isSelectionLog(log.message) && log.message?.trim());
    return {
      key,
      logs: sorted,
      startedAt: sorted[0]?.createdAt,
      lastAt: sorted[sorted.length - 1]?.createdAt,
      title: first?.message?.trim() || '선택형 상담',
    };
  });
  // 최근에 이어진 대화가 위로
  return sessions.sort((a, b) => compareLogs(b.logs[b.logs.length - 1], a.logs[a.logs.length - 1]));
}

const RISK_LEVELS = new Set(['low', 'medium', 'high']);

/** 기록 1건을 말풍선 둘(내 질문, 답)로. 선택지·도구 카드는 다시 누를 수 없으니 그리지 않는다. */
export function logToMessages(log: ChatLogItem, index: number): ChatMessage[] {
  const id = String(log.id ?? `log-${index}`);
  const timestamp = log.createdAt ?? '';
  const out: ChatMessage[] = [];
  const question = userTextOf(log.message);
  if (question.trim()) out.push({ id: `${id}-q`, role: 'user', content: question, timestamp });
  if (typeof log.reply === 'string' && log.reply.trim()) {
    out.push({
      id: `${id}-a`,
      role: 'assistant',
      content: log.reply,
      timestamp,
      riskLevel: RISK_LEVELS.has(log.riskLevel ?? '') ? (log.riskLevel as ChatRiskLevel) : undefined,
      intent: log.intent,
      emergencyWarning: Array.isArray(log.emergencyWarning)
        ? log.emergencyWarning.filter((item): item is string => typeof item === 'string')
        : undefined,
      // 옛 기록(layout 없음)은 reply 를 그대로 그린다
      layout: log.layout ?? null,
    });
  }
  return out;
}
