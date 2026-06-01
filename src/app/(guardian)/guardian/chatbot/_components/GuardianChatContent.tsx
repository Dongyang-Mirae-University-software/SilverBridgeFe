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

  // 과거 대화 복원 — 마운트 시 getChatLogs로 이전 메시지 말풍선 재구성
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

  void sending; void fallback; void input; void context; void sessionId;
  void listRef; void textareaRef; void SAMPLE_CHIPS; void sendChatMessage;
  void useCallback; void ChatContextForm; void ChatBubble; void styles;

  return null;
}
