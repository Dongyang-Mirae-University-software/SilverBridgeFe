'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Icon } from '@/components/Icon';
import { getChatErrorMessage, getChatLogs, sendChatMessage } from '@/service/api/chat';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/utils/auth/userProfile';
import type { ChatLogItem, ChatMessage } from '@/service/interface/chat';

import ChatBubble from './ChatBubble';
import styles from './GuardianChatContent.module.css';

function makeId() {
  return Math.random().toString(36).slice(2);
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return makeId();
}

function buildWelcomeMessage(name?: string): ChatMessage {
  const title = name ? `${name}님 안녕하세요 😊` : '안녕하세요 😊';

  return {
    id: 'welcome',
    role: 'assistant',
    content: `${title}\n오늘 컨디션은 어떠세요?\n약 복용·혈압·증상 무엇이든 편하게 물어보세요.`,
    timestamp: new Date().toISOString(),
  };
}

const QUICK_PROMPTS = [
  '💊 오늘 약 먹어야 해요?',
  '🩺 혈압이 어떤가요?',
  '😵 머리가 좀 아파요',
  '🏥 다음 병원 예약 알려줘',
];

const COMPOSER_MAX_LINES = 2;

export default function GuardianChatContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const [sessionId] = useState(makeSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatLogs, setChatLogs] = useState<ChatLogItem[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesRef = useRef(messages);
  const sendingRef = useRef(sending);

  messagesRef.current = messages;
  sendingRef.current = sending;

  useEffect(() => {
    if (!profile) return;

    setMessages(prev => {
      if (prev.length !== 1 || prev[0].id !== 'welcome') return prev;
      return [buildWelcomeMessage(profile.name)];
    });
  }, [profile]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const resizeComposer = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const maxHeight = lineHeight * COMPOSER_MAX_LINES + paddingTop + paddingBottom;

    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  const lastAssistantId = [...messages].reverse().find(message => message.role === 'assistant')?.id;
  const send = useCallback(
    async (text: string, uiSelection?: { field: string; value: string }) => {
      const trimmed = text.trim();
      if (!trimmed && !uiSelection) return;
      if (sendingRef.current) return;

      const history = messagesRef.current
        .filter(message => message.id !== 'welcome' && typeof message.content === 'string' && message.content.trim())
        .slice(-24)
        .map(message => ({ role: message.role, content: message.content }));

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: uiSelection ? `[선택] ${uiSelection.field}: ${uiSelection.value}` : trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setSending(true);
      setFallback(false);

      try {
        const result = await sendChatMessage({
          message: uiSelection ? undefined : trimmed,
          sessionId,
          history,
          uiSelection: uiSelection ?? undefined,
        });

        setMessages(prev => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: result.reply,
            timestamp: new Date().toISOString(),
            engine: result.engine,
            modelName: result.modelName,
            riskLevel: result.riskLevel,
            intent: result.intent,
            type: result.type,
            tool: result.tool ?? undefined,
            toolData: result.toolData,
            ui: result.ui ?? undefined,
            summary: result.summary,
            possibleCauses: result.possibleCauses,
            homeCare: result.homeCare,
            visitHospitalIf: result.visitHospitalIf,
            emergencyWarning: result.emergencyWarning,
            recommendedAction: result.recommendedAction,
            reservationRequired: result.reservationRequired,
          },
        ]);

        if (result.engine === 'fallback') setFallback(true);
      } catch (error) {
        setMessages(prev => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: getChatErrorMessage(error),
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [sessionId],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  function handleUiSelect(field: string, value: string) {
    void send('', { field, value });
  }

  function handleQuickPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  async function handleOpenHistory() {
    setHistoryOpen(true);
    setIsLogsLoading(true);
    setLogsError(null);

    try {
      setChatLogs(await getChatLogs());
    } catch (error) {
      setLogsError(getChatErrorMessage(error));
    } finally {
      setIsLogsLoading(false);
    }
  }

  return (
    <div className={styles.chatPage}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              <Icon name="brain" size={28} color="var(--sb-brand)" decorative />
            </div>
            <div className={styles.brandCopy}>
              <h1>AI 의료 챗봇</h1>
              <p>
                <span className={styles.statusDot} />
                건강 도우미 · 24시간 답변
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.historyButton} onClick={() => void handleOpenHistory()}>
              <Icon name="message" size={16} decorative />
              상담 기록
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <section className={styles.board}>
            {fallback && <div className={styles.banner}>AI 서버가 응답하지 않아 기본 응답으로 처리됐습니다.</div>}

            <div ref={listRef} className={styles.messageList}>
              {messages.map(message => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  isLastAssistant={message.id === lastAssistantId}
                  onUiSelect={handleUiSelect}
                />
              ))}

              {sending && (
                <div className={styles.typing}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              )}
            </div>
          </section>

          <section className={styles.quickPromptPanel} aria-label="추천 질문">
            <p className={styles.quickPromptTitle}>이런 걸 물어보세요</p>
            <div className={styles.quickPromptRow}>
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  className={styles.quickPromptButton}
                  disabled={sending}
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <footer className={styles.composer}>
            <div className={styles.inputWrap}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                rows={1}
                placeholder="궁금한 점을 입력하세요..."
                value={input}
                disabled={sending}
                onChange={e => {
                  setInput(e.target.value);
                  resizeComposer();
                }}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className={styles.sendButton}
                disabled={sending || !input.trim()}
                onClick={() => void send(input)}
                aria-label="전송"
              >
                <Icon name="back" size={18} className={styles.sendIcon} decorative />
              </button>
            </div>
          </footer>
        </div>
      </section>

      {historyOpen && (
        <div className={styles.historyOverlay} role="presentation" onClick={() => setHistoryOpen(false)}>
          <section
            className={styles.historyDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-history-title"
            onClick={event => event.stopPropagation()}
          >
            <header className={styles.historyHeader}>
              <div>
                <h2 id="chat-history-title">내 상담 기록</h2>
                <p>최근 상담 내용을 확인할 수 있어요.</p>
              </div>
              <button type="button" className={styles.historyCloseButton} onClick={() => setHistoryOpen(false)} aria-label="상담 기록 닫기">
                ×
              </button>
            </header>

            <div className={styles.historyList}>
              {isLogsLoading ? (
                <p className={styles.historyState}>상담 기록을 불러오는 중입니다.</p>
              ) : logsError ? (
                <p className={styles.historyState}>{logsError}</p>
              ) : chatLogs.length === 0 ? (
                <p className={styles.historyState}>아직 상담 기록이 없습니다.</p>
              ) : (
                chatLogs.map((log, index) => (
                  <article key={log.id ?? `${log.createdAt ?? 'log'}-${index}`} className={styles.historyItem}>
                    <time>{formatLogDate(log.createdAt)}</time>
                    <strong>{log.message || '선택형 상담'}</strong>
                    {log.reply && <p>{log.reply}</p>}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function formatLogDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
