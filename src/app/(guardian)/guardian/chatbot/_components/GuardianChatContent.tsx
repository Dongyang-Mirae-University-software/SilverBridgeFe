'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getChatLogs, sendChatMessage } from '@/service/api/chat';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/lib/auth/userProfile';
import type { ChatContext, ChatMessage } from '@/service/interface/chat';
import { SAMPLE_CHIPS, calcAge } from '@/service/interface/chat';
import type { IUserProfile } from '@/service/interface/user';

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

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 프로필 로드 시 context 초기값 세팅 (사용자가 이미 수정했으면 덮어쓰지 않음)
  useEffect(() => {
    if (!profile) return;
    setContext(prev => (Object.values(prev).some(Boolean) ? prev : profileToContext(profile)));
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 과거 대화 복원
  useEffect(() => {
    if (!userId) return;
    getChatLogs(userId).then(logs => {
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
    }).catch(() => {});
  }, [userId]);

  // 새 메시지 추가마다 스크롤 최하단
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // 최근 12턴 history 구성
  function buildHistory() {
    const convo = messages.filter(m => m.id !== 'welcome');
    return convo.slice(-24).map(m => ({ role: m.role, content: m.content }));
  }

  const send = useCallback(async (text: string, uiSelection?: { field: string; value: string }) => {
    const trimmed = text.trim();
    if (!trimmed && !uiSelection) return;
    if (sending) return;

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
        userId: userId ? Number(userId) : undefined,
        sessionId,
        history: buildHistory(),
        context: Object.keys(context).length > 0 ? context : undefined,
        uiSelection,
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
          tool: res.tool,
          toolData: res.toolData,
          ui: res.ui,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, userId, sessionId, context, messages]);

  // Enter 전송 / Shift+Enter 줄바꿈
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  // UI 프롬프트 선택 → uiSelection으로 재전송
  function handleUiSelect(field: string, value: string) {
    void send('', { field, value });
  }

  // 새 상담 — 메시지 초기화 + 페이지 리로드로 sessionId 갱신
  function handleNewSession() {
    setMessages([WELCOME]);
    setInput('');
    setFallback(false);
    window.location.reload();
  }

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;

  return (
    <div className={styles.chatPage}>
      {/* 상단 바 — 컨텍스트 폼 + 새 상담 버튼 */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <ChatContextForm value={context} onChange={setContext} />
        </div>
        <button type="button" className={styles.newBtn} onClick={handleNewSession}>
          새 상담
        </button>
      </div>

      {/* fallback 경고 배너 */}
      {fallback && (
        <div className={styles.fallbackWarning}>
          AI 서버가 응답하지 않아 기본 응답으로 처리됐습니다.
        </div>
      )}

      {/* 메시지 목록 */}
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

      {/* 샘플 질문 칩 */}
      <div className={styles.chips}>
        {SAMPLE_CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            className={styles.chip}
            disabled={sending}
            onClick={() => void send(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* 입력창 */}
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
    </div>
  );
}
