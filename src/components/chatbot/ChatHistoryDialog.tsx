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
}

function noop() {}

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
}: Props) {
  const sessions = useMemo(() => groupChatSessions(logs), [logs]);
  const [openKey, setOpenKey] = useState<string | null>(null);
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
            {loading ? (
              <p className={styles.state}>상담 기록을 불러오는 중입니다.</p>
            ) : error ? (
              <p className={styles.state}>{error}</p>
            ) : sessions.length === 0 ? (
              <p className={styles.state}>아직 상담 기록이 없습니다.</p>
            ) : (
              sessions.map(session => (
                <button key={session.key} type="button" className={styles.item} onClick={() => setOpenKey(session.key)}>
                  <span className={styles.itemMeta}>
                    <time>{formatLogDate(session.startedAt)}</time>
                    <span>질문 {session.logs.length}번</span>
                  </span>
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
