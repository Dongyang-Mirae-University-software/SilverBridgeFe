'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { getChatLogs, sendChatMessage } from '@/service/api/chat';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/lib/auth/userProfile';
import type { ChatContext, ChatMessage } from '@/service/interface/chat';
import { calcAge } from '@/service/interface/chat';
import type { IUserProfile } from '@/service/interface/user';

import ChatContextForm from './ChatContextForm';
import ChatBubble from './ChatBubble';
import styles from './GuardianChatContent.module.css';

const cx = classNames.bind(styles);

dayjs.locale('ko');

function makeId() {
  return Math.random().toString(36).slice(2);
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return makeId();
}

function profileToContext(profile: IUserProfile): ChatContext {
  return {
    name: profile.name || undefined,
    phone: profile.phone || undefined,
    email: profile.email || undefined,
    gender: profile.gender?.toLowerCase() || undefined,
    birthDate: profile.birthDate || undefined,
    age: profile.birthDate ? calcAge(profile.birthDate) : undefined,
    postcode: profile.postcode || undefined,
    address: profile.address || undefined,
    addressDetail: profile.addressDetail || undefined,
    location: profile.address || undefined,
    guardianId: Number(profile.id) || undefined,
    role: profile.role,
  };
}

function formatClock(value?: string) {
  if (!value) return '-';
  return dayjs(value).format('A h:mm');
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

export default function GuardianChatContent() {
  const router = useRouter();
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const userId = profile?.id ?? '';

  const [sessionId, setSessionId] = useState(makeSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);
  const [context, setContext] = useState<ChatContext>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contextRef = useRef(context);
  const messagesRef = useRef(messages);
  const sendingRef = useRef(sending);

  contextRef.current = context;
  messagesRef.current = messages;
  sendingRef.current = sending;

  useEffect(() => {
    if (!profile) return;

    setContext(prev => (Object.values(prev).some(Boolean) ? prev : profileToContext(profile)));
    setMessages(prev => {
      if (prev.length !== 1 || prev[0].id !== 'welcome') return prev;
      return [buildWelcomeMessage(profile.name)];
    });
  }, [profile]);

  useEffect(() => {
    if (!userId) return;

    getChatLogs(userId)
      .then(logs => {
        if (logs.length === 0) return;

        const restored: ChatMessage[] = [];
        logs.forEach(log => {
          if (log.message) {
            restored.push({
              id: makeId(),
              role: 'user',
              content: log.message,
              timestamp: log.createdAt ?? new Date().toISOString(),
            });
          }

          if (log.reply) {
            restored.push({
              id: makeId(),
              role: 'assistant',
              content: log.reply,
              timestamp: log.createdAt ?? new Date().toISOString(),
              engine: log.engine,
              intent: log.intent,
              tool: log.tool as ChatMessage['tool'],
              toolData: log.toolData,
              type: log.type as ChatMessage['type'],
              ui: log.ui,
            });
          }
        });

        if (restored.length > 0) {
          setMessages([buildWelcomeMessage(profile?.name), ...restored]);
        }
      })
      .catch(() => {});
  }, [profile?.name, userId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const lastAssistantId = [...messages].reverse().find(message => message.role === 'assistant')?.id;
  const lastUpdatedAt = [...messages].reverse()[0]?.timestamp;
  const contextFilledCount = Object.values(context).filter(Boolean).length;

  const contextSummary = useMemo(
    () => [
      { label: '이름', value: context.name || profile?.name || '-' },
      { label: '생년월일', value: context.birthDate || profile?.birthDate || '-' },
      { label: '전화번호', value: context.phone || profile?.phone || '-' },
      { label: '지역', value: context.location || context.address || profile?.address || '-' },
    ],
    [context, profile],
  );

  const send = useCallback(
    async (text: string, uiSelection?: { field: string; value: string }) => {
      const trimmed = text.trim();
      if (!trimmed && !uiSelection) return;
      if (sendingRef.current) return;

      const currentContext = contextRef.current;
      const history = messagesRef.current
        .filter(message => message.id !== 'welcome')
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
          userId: 1,
          sessionId,
          history,
          context: Object.keys(currentContext).length > 0 ? currentContext : undefined,
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
      } catch {
        setMessages(prev => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
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

  function handleNewSession() {
    setSessionId(makeSessionId());
    setMessages([buildWelcomeMessage(profile?.name)]);
    setInput('');
    setFallback(false);
    setContext(profile ? profileToContext(profile) : {});
    setContextOpen(false);
    textareaRef.current?.focus();
  }

  function handleBack() {
    router.back();
  }

  return (
    <div className={styles.chatPage}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              <Icon name="brain" size={28} color="#fff" decorative />
            </div>
            <div className={styles.brandCopy}>
              <h1>AI 의료 챗봇</h1>
              <p>건강 도우미 · 24시간 답변</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button type="button" className={styles.backButton} onClick={handleBack}>
              <Icon name="back" size={16} decorative />
              뒤로
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarActions}>
              <button
                type="button"
                className={cx('utilityButton', contextOpen && 'utilityButtonActive')}
                onClick={() => setContextOpen(prev => !prev)}
              >
                상담 컨텍스트
              </button>
              <button type="button" className={styles.utilityButton} onClick={handleNewSession}>
                새 상담
              </button>
            </div>

            <span className={styles.toolbarMeta}>
              최근 답변 <strong>{formatClock(lastUpdatedAt)}</strong>
            </span>
          </div>

          {contextOpen && (
            <section className={styles.contextPanel}>
              <div className={styles.contextSummary}>
                {contextSummary.map(item => (
                  <div key={item.label} className={styles.contextItem}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <ChatContextForm value={context} onChange={setContext} />
            </section>
          )}

          <section className={styles.board}>
            {fallback && (
              <div className={styles.banner}>AI 서버가 응답하지 않아 기본 응답으로 처리됐습니다.</div>
            )}

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

          <section className={styles.suggestionPanel}>
            <p className={styles.suggestionTitle}>이런 걸 물어보세요</p>
            <div className={styles.chips}>
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  className={styles.chip}
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
                rows={2}
                placeholder="궁금한 점을 입력하세요..."
                value={input}
                disabled={sending}
                onChange={e => setInput(e.target.value)}
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
    </div>
  );
}
