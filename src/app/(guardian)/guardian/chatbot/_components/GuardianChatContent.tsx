'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getChatLogs, sendChatMessage } from '@/service/api/chat';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/lib/auth/userProfile';
import type { ChatContext, ChatMessage } from '@/service/interface/chat';
import { SAMPLE_CHIPS, calcAge } from '@/service/interface/chat';
import type { IUserProfile } from '@/service/interface/user';

import ChatContextForm from './ChatContextForm';
import ChatBubble from './ChatBubble';
import styles from './GuardianChatContent.module.css';

function makeId() {
  return Math.random().toString(36).slice(2);
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return makeId();
}

function profileToContext(p: IUserProfile): ChatContext {
  return {
    name: p.name || undefined,
    phone: p.phone || undefined,
    email: p.email || undefined,
    gender: p.gender?.toLowerCase() || undefined,
    birthDate: p.birthDate || undefined,
    age: p.birthDate ? calcAge(p.birthDate) : undefined,
    postcode: p.postcode || undefined,
    address: p.address || undefined,
    addressDetail: p.addressDetail || undefined,
    location: p.address || undefined,
    guardianId: Number(p.id) || undefined,
    role: p.role,
  };
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '안녕하세요. 무엇을 도와드릴까요? 건강 상담, 병원 예약, 응급 안내 등을 도와드릴 수 있습니다.',
  timestamp: new Date().toISOString(),
};

export default function GuardianChatContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const userId = profile?.id ?? '';

  const [sessionId] = useState(makeSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [context, setContext] = useState<ChatContext>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 렌더마다 동기 업데이트 — send 호출 시점에 항상 최신값 보장
  const profileRef = useRef(profile);
  const contextRef = useRef(context);
  const messagesRef = useRef(messages);
  const sendingRef = useRef(sending);
  profileRef.current = profile;
  contextRef.current = context;
  messagesRef.current = messages;
  sendingRef.current = sending;

  // 프로필 로드 시 context 초기값 세팅
  useEffect(() => {
    if (!profile) return;
    setContext(prev => (Object.values(prev).some(Boolean) ? prev : profileToContext(profile)));
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 과거 대화 복원
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
        if (restored.length > 0) setMessages([WELCOME, ...restored]);
      })
      .catch(() => {});
  }, [userId]);

  // 새 메시지마다 스크롤 최하단
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(
    async (text: string, uiSelection?: { field: string; value: string }) => {
      const trimmed = text.trim();
      if (!trimmed && !uiSelection) return;
      if (sendingRef.current) return;

      const currentContext = contextRef.current;
      const history = messagesRef.current
        .filter(m => m.id !== 'welcome')
        .slice(-24)
        .map(m => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: uiSelection ? `[선택] ${uiSelection.field}: ${uiSelection.value}` : trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setSending(true);
      setFallback(false);

      try {
        const res = await sendChatMessage({
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
            content: res.reply,
            timestamp: new Date().toISOString(),
            engine: res.engine,
            modelName: res.modelName,
            riskLevel: res.riskLevel,
            intent: res.intent,
            type: res.type,
            tool: res.tool ?? undefined,
            toolData: res.toolData,
            ui: res.ui ?? undefined,
            summary: res.summary,
            possibleCauses: res.possibleCauses,
            homeCare: res.homeCare,
            visitHospitalIf: res.visitHospitalIf,
            emergencyWarning: res.emergencyWarning,
            recommendedAction: res.recommendedAction,
            reservationRequired: res.reservationRequired,
          },
        ]);
        if (res.engine === 'fallback') setFallback(true);
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function handleUiSelect(field: string, value: string) {
    void send('', { field, value });
  }

  function handleChipClick(chip: string) {
    setInput(chip);
    textareaRef.current?.focus();
  }

  function handleNewSession() {
    setMessages([WELCOME]);
    setInput('');
    setFallback(false);
    window.location.reload();
  }

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;

  return (
    <div className={styles.chatPage}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <ChatContextForm value={context} onChange={setContext} />
        </div>
        <button type="button" className={styles.newBtn} onClick={handleNewSession}>
          새 상담
        </button>
      </div>

      {fallback && <div className={styles.fallbackWarning}>AI 서버가 응답하지 않아 기본 응답으로 처리됐습니다.</div>}

      <div ref={listRef} className={styles.messageList}>
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isLastAssistant={msg.id === lastAssistantId}
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

      <footer className={styles.chatFooter}>
        <div className={styles.suggestionPanel}>
          <div className={styles.suggestionHeader}>
            <div className={styles.suggestionTitle}>
              <strong>추천 질문</strong>
              <span>{suggestionsOpen ? '선택하면 입력창에 채워집니다' : '필요할 때 펼쳐서 사용할 수 있습니다'}</span>
            </div>
            <button
              type="button"
              className={styles.suggestionToggle}
              aria-expanded={suggestionsOpen}
              onClick={() => setSuggestionsOpen(open => !open)}
            >
              {suggestionsOpen ? '접기' : '펼치기'}
            </button>
          </div>
          {suggestionsOpen && (
            <div className={styles.chips}>
              {SAMPLE_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  className={styles.chip}
                  disabled={sending}
                  onClick={() => handleChipClick(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={2}
            placeholder="메시지를 입력하세요 (Enter 전송 · Shift+Enter 줄바꿈)"
            value={input}
            disabled={sending}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className={styles.sendBtn}
            disabled={sending || !input.trim()}
            onClick={() => void send(input)}
          >
            전송
          </button>
        </div>
      </footer>
    </div>
  );
}
