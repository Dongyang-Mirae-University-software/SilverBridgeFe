'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getChatLogs, sendChatMessage } from '@/service/api/chat';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/lib/auth/userProfile';
import type { ChatContext, ChatMessage } from '@/service/interface/chat';
import { SAMPLE_CHIPS } from '@/service/interface/chat';

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

  // 최근 12턴 history 구성 (welcome 제외, 최대 24개 메시지)
  function buildHistory() {
    const convo = messages.filter(m => m.id !== 'welcome');
    return convo.slice(-24).map(m => ({ role: m.role, content: m.content }));
  }

  // 메시지 전송 — 일반 텍스트 또는 uiSelection(UI 프롬프트 응답)
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

      const assistantMsg: ChatMessage = {
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
      };

      setMessages(prev => [...prev, assistantMsg]);
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

  void fallback; void input; void setContext; void SAMPLE_CHIPS;
  void ChatContextForm; void ChatBubble; void styles;

  return null;
}
