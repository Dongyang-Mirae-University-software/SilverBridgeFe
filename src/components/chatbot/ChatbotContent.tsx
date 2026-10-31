'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { WardSelectorTabs } from '@/components/connections/WardSelectorTabs';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { useSoftKeyboardOpen } from '@/hooks/useSoftKeyboardOpen';
import { getAuthRole } from '@/lib/auth/tokenStore';
import { getChatErrorMessage, getChatLogs, sendChatMessage } from '@/service/api/chat';
import { getHistoryWarning } from '@/service/api/chatPolicy';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { calcAge, type ChatLogItem, type ChatMessage } from '@/service/interface/chat';

import ChatBubble from './ChatBubble';
import styles from './ChatbotContent.module.css';
import { saveReservationWardId } from './reservationWardHandoff';

function makeId() {
  return Math.random().toString(36).slice(2);
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return makeId();
}

function buildWelcomeMessage(name?: string, isGuardian = false): ChatMessage {
  if (isGuardian && name) {
    return {
      id: 'welcome',
      role: 'assistant',
      content: `안녕하세요\n${name}의 증상을 말씀해 주시면 맞는 진료과를 알려 드리고, 바로 병원 예약도 도와드려요.`,
      timestamp: new Date().toISOString(),
    };
  }

  // 피보호자 화면의 빠른 질문은 넓은 화면에서 오른쪽, 휴대폰에서 아래에 놓이므로 위치를 말하지 않는다.
  return {
    id: 'welcome',
    role: 'assistant',
    content: `${name ? `안녕하세요, ${name} 님` : '안녕하세요'}\n어디가 불편하세요?\n버튼을 눌러 물어보세요.`,
    timestamp: new Date().toISOString(),
  };
}

type GuardianPrompt = {
  text: string;
  primary?: boolean;
  /** send: AI에 보낸다(기본). reservation: AI를 부르지 않고 내 말풍선만 남긴 뒤 병원 예약 화면으로 이동한다. */
  action?: 'send' | 'reservation';
};

const GUARDIAN_PROMPTS: GuardianPrompt[] = [
  { text: '병원 예약하고 싶어요', primary: true, action: 'reservation' },
  { text: '무릎이 아프다고 하세요' },
  { text: '혈압약을 같이 먹어도 되나요?' },
  { text: '다음 병원 예약 알려줘' },
];

const WARD_PROMPTS = ['머리가 아파요', '배가 아파요', '무릎이 아파요', '어지러워요'];

const MAX_SUGGESTED = 3;

const RESERVATION_PATH = '/guardian/hospital';
/** 남긴 말풍선을 잠깐 보여 준 뒤 이동한다. */
const RESERVATION_NAV_DELAY_MS = 300;

/** 최신 답의 이어서 물어볼 질문. 없거나 형식이 다르면 빈 목록(고정 문장을 쓴다). */
function latestSuggestions(messages: ChatMessage[]): string[] {
  const last = [...messages].reverse().find(message => message.role === 'assistant');
  const raw = last?.suggestedQuestions;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((q): q is string => typeof q === 'string').map(q => q.trim()).filter(Boolean))].slice(
    0,
    MAX_SUGGESTED,
  );
}

/**
 * 보호자: 예약 칩은 항상 맨 앞(누른 뒤에도 남긴다), 그 뒤에 이어질 질문(없으면 고정 문장).
 * 이 대화창에서 이미 보낸 문장은 뺀다.
 */
function guardianPrompts(suggested: string[], sent: ReadonlySet<string>): GuardianPrompt[] {
  const booking = GUARDIAN_PROMPTS[0];
  const unsent = suggested.filter(text => text !== booking.text && !sent.has(text));
  const rest =
    unsent.length > 0 ? unsent.map(text => ({ text })) : GUARDIAN_PROMPTS.slice(1).filter(p => !sent.has(p.text));
  return [booking, ...rest];
}

/** 피보호자: 이어질 질문을 먼저, 남는 칸은 기본 문장으로 채운다(최대 4개). 이미 보낸 문장은 빼므로 칸 수가 줄 수 있다. */
function wardPrompts(suggested: string[], sent: ReadonlySet<string>) {
  const items = suggested.filter(text => !sent.has(text)).map(text => ({ text, suggested: true }));
  for (const text of WARD_PROMPTS) {
    if (items.length >= WARD_PROMPTS.length) break;
    if (!sent.has(text) && !suggested.includes(text)) items.push({ text, suggested: false });
  }
  return items;
}

const COMPOSER_MAX_LINES = 2;

interface ChatbotContentProps {
  /**
   * 보호자 화면은 선택 대상·상담 기록·추천 질문 칩을 제공한다.
   * 피보호자 화면은 대화창과 큰 빠른 질문 버튼을 나란히 둔 큰 글씨 상담 화면을 사용한다.
   */
  variant?: 'guardian' | 'ward';
}

export default function ChatbotContent({ variant = 'guardian' }: ChatbotContentProps) {
  const router = useRouter();
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const isGuardian = getAuthRole() === 'GUARDIAN';
  const isWardChat = variant === 'ward';
  const { activeWards } = useGuardianActiveWards(isGuardian);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const selectedWard = activeWards.find(ward => ward.partnerUserId === selectedWardId) ?? activeWards[0] ?? null;
  const [sessionId, setSessionId] = useState(makeSessionId);
  // 대화창(sessionId)마다 이미 보낸 문장 - 빠른 질문에서 뺀다. 상담 내용이라 브라우저 저장소에 남기지 않는다(새로고침하면 비워진다).
  const [sentBySession, setSentBySession] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatLogs, setChatLogs] = useState<ChatLogItem[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const softKeyboardOpen = useSoftKeyboardOpen();
  // 입력 중이고 화면 키보드가 떠 있을 때만 빠른 질문을 숨긴다(키보드를 내리면 포커스가 남아도 다시 보인다).
  const typingWithKeyboard = composerFocused && softKeyboardOpen;

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendingRef = useRef(sending);
  const reservationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  sendingRef.current = sending;

  useEffect(() => {
    if (!profile) return;

    setMessages(prev => {
      if (prev.length !== 1 || prev[0].id !== 'welcome') return prev;
      return [buildWelcomeMessage(isGuardian ? selectedWard?.partnerName : profile.name, isGuardian)];
    });
  }, [isGuardian, profile, selectedWard?.partnerName]);

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
  const suggested = latestSuggestions(messages);
  const sentTexts = new Set(sentBySession[sessionId] ?? []);
  // 서버는 버튼·날짜·지역 선택도 "[선택] field: value" 형식의 별도 기록으로 남긴다.
  // 이는 실제 상담 시작점이 아니므로 내 상담 기록 목록에서는 제외한다.
  const historyItems = Array.isArray(chatLogs) ? chatLogs.filter(log => !isUiSelectionLog(log.message)) : [];
  const send = useCallback(
    async (
      text: string,
      uiSelection?: { field: string; value: string },
      uiSelectionLabel?: string,
      refocusComposer = false,
    ) => {
      const trimmed = text.trim();
      if (!trimmed && !uiSelection) return;
      if (sendingRef.current) return;

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: uiSelection ? uiSelectionLabel ?? uiSelection.value : trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setSending(true);
      setFallback(false);

      try {
        const wardBirthDate = selectedWard?.partnerBirthDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
        // 피보호자 본인 상담은 역할만 보낸다(개인정보는 서버에 싣지 않는다).
        // 보호자 상담은 선택한 피보호자 정보를 예약 도구에 전달한다.
        const role = getAuthRole() ?? undefined;
        const context =
          isGuardian && selectedWard
            ? {
                role: 'GUARDIAN',
                name: selectedWard.partnerName,
                age: wardBirthDate ? calcAge(wardBirthDate) : undefined,
                birthDate: wardBirthDate,
                phone: selectedWard.partnerPhone ?? undefined,
                gender: selectedWard.partnerGender ?? undefined,
                wardId: selectedWard.partnerUserId,
                wardName: selectedWard.partnerName,
                patientId: selectedWard.partnerUserId,
                patientName: selectedWard.partnerName,
                patientBirthDate: wardBirthDate,
                patientPhone: selectedWard.partnerPhone ?? undefined,
                patientGender: selectedWard.partnerGender ?? undefined,
                relation: selectedWard.relation ?? undefined,
              }
            : { role };

        // 대화 맥락은 AI가 같은 sessionId의 서버 기록으로 만든다 - 이력은 보내지 않는다(2026-10-29, AI #91).
        const result = await sendChatMessage({
          message: uiSelection ? undefined : trimmed,
          sessionId,
          context,
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
            suggestedQuestions: result.suggestedQuestions,
          },
        ]);

        // 답을 받은 문장만 기억한다 - 보내기에 실패한 문장은 다시 누를 수 있게 버튼에 남긴다.
        if (!uiSelection) {
          setSentBySession(prev => ({ ...prev, [sessionId]: [...(prev[sessionId] ?? []), trimmed] }));
        }

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
        // 입력창에서 보낸 경우에만 되돌린다. 빠른 질문·선택지를 누른 뒤 포커스를 옮기면
        // 휴대폰 키보드가 올라와 대화를 가리고, 피보호자 화면은 빠른 질문 칸까지 숨겨진다.
        if (refocusComposer) textareaRef.current?.focus();
      }
    },
    [isGuardian, selectedWard, sessionId],
  );

  useEffect(
    () => () => {
      if (reservationTimerRef.current) clearTimeout(reservationTimerRef.current);
    },
    [],
  );

  // AI를 부르지 않으므로 챗 기록에 저장되지 않고, 보낸 문장 기억에도 넣지 않는다(칩은 항상 남는다).
  function openReservation(text: string) {
    if (sendingRef.current || reservationTimerRef.current) return;
    setMessages(prev => [...prev, { id: makeId(), role: 'user', content: text, timestamp: new Date().toISOString() }]);
    const wardId = selectedWard?.partnerUserId;
    // 이동 직전에 담는다 - 타이머가 취소되면(화면 이탈) 저장소에 남지 않는다.
    reservationTimerRef.current = setTimeout(() => {
      saveReservationWardId(wardId);
      router.push(RESERVATION_PATH);
    }, RESERVATION_NAV_DELAY_MS);
  }

  function handleWardSelect(wardId: string) {
    if (wardId === selectedWard?.partnerUserId) return;
    const ward = activeWards.find(item => item.partnerUserId === wardId);
    setSelectedWardId(wardId);
    setSessionId(makeSessionId());
    setSentBySession({});
    setMessages([buildWelcomeMessage(ward?.partnerName, true)]);
    setInput('');
    setFallback(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input, undefined, undefined, true);
    }
  }

  function handleUiSelect(field: string, value: string, label?: string) {
    void send('', { field, value }, label);
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

  const board = (
    <section className={styles.board}>
      {fallback && <div className={styles.banner}>AI 서버가 응답하지 않아 기본 응답으로 처리됐습니다.</div>}

      <div ref={listRef} className={styles.messageList}>
        {messages.map(message => (
          <ChatBubble
            key={message.id}
            message={message}
            isLastAssistant={message.id === lastAssistantId}
            onUiSelect={handleUiSelect}
            userImageUrl={profile?.profileImage}
            userName={profile?.name}
            variant={isWardChat ? 'ward' : 'guardian'}
          />
        ))}

        {sending && (
          <div className={styles.typing} role="status" aria-live="polite" aria-label="답변을 만들고 있어요">
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        )}
      </div>
    </section>
  );

  const composer = (
    <footer className={styles.composer}>
      <div className={styles.inputWrap}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          aria-label="궁금한 점 입력"
          placeholder={isWardChat ? '직접 써서 물어보기' : '여기에 궁금한 점을 써 주세요'}
          value={input}
          disabled={sending}
          onChange={e => {
            setInput(e.target.value);
            resizeComposer();
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
        />
        <button
          type="button"
          className={styles.sendButton}
          disabled={sending || !input.trim()}
          onClick={() => void send(input, undefined, undefined, true)}
        >
          보내기
        </button>
      </div>
    </footer>
  );

  if (isWardChat) {
    const wardQuickPrompts = wardPrompts(suggested, sentTexts);
    return (
      <div className={`${styles.chatPage} ${styles.wardVariant}`}>
        <section className={styles.shell}>
          <h1 className={styles.wardTitle}>AI 의료 챗봇</h1>
          <div className={`${styles.wardBody} ${typingWithKeyboard ? styles.typingWithKeyboard : ''}`}>
            <div className={styles.wardChatCard}>
              {board}
              {composer}
            </div>

            <section className={styles.wardQuickPanel} aria-label="추천 질문">
              <p className={styles.wardQuickTitle}>눌러서 물어보세요</p>
              {wardQuickPrompts.length === 0 ? (
                <p className={styles.wardQuickEmpty}>궁금한 점을 입력창에 적어 주세요</p>
              ) : (
                <div className={styles.wardQuickGrid}>
                  {wardQuickPrompts.map(prompt => (
                    <button
                      key={prompt.text}
                      type="button"
                      className={styles.wardQuickButton}
                      disabled={sending}
                      onClick={() => void send(prompt.text)}
                    >
                      <span className={styles.wardQuickIcon} aria-hidden="true">
                        <Icon name={prompt.suggested ? 'message' : 'alert'} size={28} decorative />
                      </span>
                      <span>{prompt.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.chatPage}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              <svg width="38" height="38" viewBox="0 0 60 60" aria-hidden="true">
                <circle cx="14" cy="16" r="8" fill="#C9986A" />
                <circle cx="46" cy="16" r="8" fill="#C9986A" />
                <circle cx="14" cy="16" r="4" fill="#F5C9A8" />
                <circle cx="46" cy="16" r="4" fill="#F5C9A8" />
                <ellipse cx="30" cy="32" rx="20" ry="18" fill="#F5C9A8" />
                <ellipse cx="30" cy="38" rx="11" ry="9" fill="#FFE4D0" />
                <circle cx="22" cy="28" r="2" fill="#3D2A1E" />
                <circle cx="38" cy="28" r="2" fill="#3D2A1E" />
                <ellipse cx="30" cy="35" rx="2" ry="1.4" fill="#3D2A1E" />
                <path d="M28 38 Q30 41 32 38" fill="none" stroke="#3D2A1E" strokeLinecap="round" strokeWidth="1.4" />
                <circle cx="17" cy="34" r="2.4" fill="#FFB3B8" opacity="0.7" />
                <circle cx="43" cy="34" r="2.4" fill="#FFB3B8" opacity="0.7" />
              </svg>
            </div>
            <div className={styles.brandCopy}>
              <h1>AI 의료 챗봇</h1>
              <p>증상 상담부터 병원 예약까지 도와드려요</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.historyButton} onClick={() => void handleOpenHistory()}>
              <Icon name="message" size={16} decorative />
              상담 기록
            </button>
          </div>
        </header>

        {isGuardian && activeWards.length > 0 && selectedWard && (
          <section className={styles.wardTarget} aria-label="상담할 피보호자">
            <span>상담할 피보호자</span>
            <WardSelectorTabs
              wards={activeWards.map(ward => ({
                wardId: ward.partnerUserId,
                wardName: ward.partnerName,
                profileImage: ward.partnerProfileImage,
                relation: ward.relation,
              }))}
              selectedWardId={selectedWard.partnerUserId}
              onSelect={handleWardSelect}
            />
          </section>
        )}

        <div className={`${styles.body} ${typingWithKeyboard ? styles.typingWithKeyboard : ''}`}>
          {board}

          <section className={styles.quickPromptPanel} aria-label="추천 질문">
            <p className={styles.quickPromptTitle}>눌러서 물어보세요</p>
            <div className={styles.quickPromptRow}>
              {guardianPrompts(suggested, sentTexts).map(prompt => (
                <button
                  key={prompt.text}
                  type="button"
                  className={`${styles.quickPromptButton} ${prompt.primary ? styles.quickPromptPrimary : ''}`}
                  disabled={sending}
                  onClick={() =>
                    prompt.action === 'reservation' ? openReservation(prompt.text) : void send(prompt.text)
                  }
                >
                  {prompt.primary && <Icon name="calendar" size={18} decorative />}
                  {prompt.text}
                </button>
              ))}
            </div>
          </section>

          {composer}
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
              <button
                type="button"
                className={styles.historyCloseButton}
                onClick={() => setHistoryOpen(false)}
                aria-label="상담 기록 닫기"
              >
                ×
              </button>
            </header>

            <div className={styles.historyList}>
              {isLogsLoading ? (
                <p className={styles.historyState}>상담 기록을 불러오는 중입니다.</p>
              ) : logsError ? (
                <p className={styles.historyState}>{logsError}</p>
              ) : historyItems.length === 0 ? (
                <p className={styles.historyState}>아직 상담 기록이 없습니다.</p>
              ) : (
                historyItems.map((log, index) => {
                  const warning = getHistoryWarning(log.emergencyWarning);
                  return (
                    <article key={log.id ?? `${log.createdAt ?? 'log'}-${index}`} className={styles.historyItem}>
                      <time>{formatLogDate(log.createdAt)}</time>
                      <strong>{log.message || '선택형 상담'}</strong>
                      {log.reply && <p>{log.reply}</p>}
                      {warning && <p className={styles.historyWarning}>{warning}</p>}
                    </article>
                  );
                })
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

function isUiSelectionLog(message?: string) {
  return /^\s*\[선택\]\s*/.test(message ?? '');
}
