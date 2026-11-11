'use client';

import { useMemo, useState } from 'react';
import type { ChatLogItem } from '@/service/interface/chat';
import ChatBubble from './ChatBubble';
import { groupChatSessions, logToMessages, type ChatHistorySession } from './chatHistorySessions';
import styles from './ChatHistoryDialog.module.css';

interface Props {
  logs: ChatLogItem[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  variant?: 'guardian' | 'ward';
  userImageUrl?: string | null;
  userName?: string | null;
  /** 보호자의 연결된 피보호자 - 주면 기록을 누구의 상담인지 나눠 보인다(2026-11-11) */
  wards?: { id: string; name: string }[];
}

type Filter = 'all' | 'self' | `ward:${string}`;

function noop() {}

type Target = Pick<ChatHistorySession, 'wardId' | 'withSelf' | 'wardIds'>;

/** 대화창에 나온 피보호자 전부(옛 형태는 wardId 하나). */
function wardsOf({ wardId, wardIds }: Target): string[] {
  if (wardIds && wardIds.length > 0) return wardIds;
  return typeof wardId === 'string' ? [wardId] : [];
}

/**
 * 기록의 상담 대상 이름. 알 수 없으면(옛 서버) null - 표시하지 않는다.
 * 본인 상담 중 피보호자 예약을 했으면 "○○ 님 예약", 피보호자 턴만 있으면(선택 칸이 있던 때 기록) "○○ 님 상담".
 */
function targetLabel(target: Target, wards: { id: string; name: string }[]) {
  if (target.wardId === undefined) return null;
  if (target.wardId === null) return '내 상담';
  const kind = target.withSelf ? '예약' : '상담';
  const [first, ...others] = wardsOf(target);
  const ward = wards.find(item => item.id === first);
  const more = others.length > 0 ? ` 외 ${others.length}명` : '';
  return ward ? `${ward.name} 님${more} ${kind}` : `연결이 끝난 피보호자${more} ${kind}`;
}

/** 본인 턴이 섞인 대화창은 "내 상담"에도, 그 피보호자에도 보인다. */
function matches(filter: Filter, target: Target) {
  if (filter === 'all') return true;
  if (filter === 'self') return target.wardId === null || Boolean(target.withSelf);
  return wardsOf(target).includes(filter.slice('ward:'.length));
}

export function formatLogDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** 내 상담 기록 - 대화창 단위 목록, 누르면 그 대화의 질문·답 전체(2026-11-11). */
export default function ChatHistoryDialog({
  logs,
  loading,
  error,
  onClose,
  variant = 'guardian',
  userImageUrl,
  userName,
  wards,
}: Props) {
  const sessions = useMemo(() => groupChatSessions(logs), [logs]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // 보호자이고 서버가 상담 대상을 알려 줄 때만 나눈다(칸이 없는 옛 서버면 지금처럼 한 목록)
  const byTarget = Boolean(wards) && sessions.some(session => session.wardId !== undefined);
  const targetWards = wards ?? [];
  const filters: { key: Filter; label: string }[] = byTarget
    ? [
        { key: 'all', label: '전체' },
        ...targetWards
          .filter(ward => sessions.some(session => wardsOf(session).includes(ward.id)))
          .map(ward => ({ key: `ward:${ward.id}` as Filter, label: ward.name })),
        ...(sessions.some(session => matches('self', session)) ? [{ key: 'self' as Filter, label: '내 상담' }] : []),
      ]
    : [];
  const shown = byTarget ? sessions.filter(session => matches(filter, session)) : sessions;
  const opened = openKey ? sessions.find(session => session.key === openKey) : undefined;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-history-title"
        onClick={event => event.stopPropagation()}
      >
        <header className={styles.header}>
          {opened ? (
            <div className={styles.headerText}>
              <button type="button" className={styles.backButton} onClick={() => setOpenKey(null)}>
                ‹ 목록으로
              </button>
              <h2 id="chat-history-title">상담 내용</h2>
              <p>{formatLogDate(opened.startedAt)}</p>
            </div>
          ) : (
            <div className={styles.headerText}>
              <h2 id="chat-history-title">내 상담 기록</h2>
              <p>상담을 누르면 주고받은 대화를 모두 볼 수 있어요.</p>
            </div>
          )}
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="상담 기록 닫기">
            ×
          </button>
        </header>

        {opened ? (
          <SessionDetail session={opened} variant={variant} userImageUrl={userImageUrl} userName={userName} />
        ) : (
          <div className={styles.list}>
            {!loading && !error && filters.length > 2 && (
              <div className={styles.filters} role="group" aria-label="누구의 상담인지 고르기">
                {filters.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={styles.filterChip}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {loading ? (
              <p className={styles.state}>상담 기록을 불러오는 중입니다.</p>
            ) : error ? (
              <p className={styles.state}>{error}</p>
            ) : shown.length === 0 ? (
              <p className={styles.state}>아직 상담 기록이 없습니다.</p>
            ) : (
              shown.map(session => (
                <button key={session.key} type="button" className={styles.item} onClick={() => setOpenKey(session.key)}>
                  <span className={styles.itemMeta}>
                    <time>{formatLogDate(session.startedAt)}</time>
                    <span>질문 {session.logs.length}번</span>
                  </span>
                  {byTarget && targetLabel(session, targetWards) && (
                    <span className={styles.itemTarget}>{targetLabel(session, targetWards)}</span>
                  )}
                  <strong>{session.title}</strong>
                  <span className={styles.itemMore}>대화 보기 ›</span>
                </button>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionDetail({
  session,
  variant,
  userImageUrl,
  userName,
}: {
  session: ChatHistorySession;
  variant: 'guardian' | 'ward';
  userImageUrl?: string | null;
  userName?: string | null;
}) {
  const messages = session.logs.flatMap((log, index) => logToMessages(log, index));
  return (
    <div className={styles.detail} aria-label="상담 대화">
      {messages.map(message => (
        <ChatBubble
          key={message.id}
          message={message}
          isLastAssistant={false}
          onUiSelect={noop}
          onShowList={noop}
          hidePrompt
          userImageUrl={userImageUrl}
          userName={userName}
          variant={variant}
        />
      ))}
    </div>
  );
}
