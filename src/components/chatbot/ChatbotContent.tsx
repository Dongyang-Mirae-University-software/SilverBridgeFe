'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { useGuardianActiveWards } from '@/hooks/useActiveConnections';
import { useSoftKeyboardOpen } from '@/hooks/useSoftKeyboardOpen';
import { getAccessTokenSubject, getAuthRole } from '@/lib/auth/tokenStore';
import { getChatErrorMessage, getChatLogs, sendChatMessage } from '@/service/api/chat';
import { myProfileQueryOptions } from '@/service/query/user/profile';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { type ChatLogItem, type ChatMessage } from '@/service/interface/chat';
import {
  conversationKey,
  loadConversation,
  pruneWardConversations,
  removeConversation,
  saveConversation,
} from '@/store/chatConversationStore';
import { setSelectedWardId } from '@/store/selectedWardStore';

import ChatBubble from './ChatBubble';
import ChatHistoryDialog from './ChatHistoryDialog';
import ChatUiPrompt from './ChatUiPrompt';
import { isUrgentAnswer } from './chatUrgency';
import VoiceInputButton from './VoiceInputButton';
import { useVoiceInput } from './useVoiceInput';
import { buttonWardId, isReservationStep, isShowList, selectionText, textWardId } from './reservationFlow';
import styles from './ChatbotContent.module.css';

function makeId() {
  return Math.random().toString(36).slice(2);
}

/** 화면 이동 칩(예약·예약 목록)이 남기는 내 말풍선 id 앞머리 - AI에 보내지 않아 답이 없는 것이 정상이다. */
const NAV_MESSAGE_PREFIX = 'nav-';

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return makeId();
}

function buildWelcomeMessage(name?: string, isGuardian = false): ChatMessage {
  // 보호자 챗봇은 보호자 본인 상담으로 시작한다 - 예약을 시작하면 AI가 누구의 예약인지 묻는다(2026-11-11 사용자 결정)
  if (isGuardian) {
    return {
      id: 'welcome',
      role: 'assistant',
      content: '안녕하세요\n증상을 말씀해 주시면 맞는 진료과를 알려 드리고, 연결된 분의 병원 예약도 도와드려요.',
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
};

// 예약 칩도 AI에 보낸다 - 챗봇 안에서 "누구의 병원 예약인가요?"부터 시작한다(2026-11-11 사용자 결정, 전에는 예약 화면으로 이동)
const GUARDIAN_PROMPTS: GuardianPrompt[] = [
  { text: '병원 예약하고 싶어요', primary: true },
  { text: '무릎이 아프다고 하세요' },
  { text: '혈압약을 같이 먹어도 되나요?' },
  { text: '다음 병원 예약 알려줘' },
];

const WARD_PROMPTS = ['머리가 아파요', '배가 아파요', '무릎이 아파요', '어지러워요'];

const MAX_SUGGESTED = 4;
/** 되묻기 답 칩(AI suggestedKind). 문구가 아니라 칸의 코드 값을 본다. */
const ANSWER_KIND = 'answer';

/** 예약 목록 보기 = 역할별 "병원 가는 날" 화면(AI로 show_list 를 보내지 않는다). 보호자 화면은 전역으로 고른 피보호자로 열린다. */
const WARD_VISIT_LIST_PATH = '/ward/hospital';
const GUARDIAN_VISIT_LIST_PATH = '/guardian/hospital';
/** 남긴 말풍선을 잠깐 보여 준 뒤 이동한다. */
const RESERVATION_NAV_DELAY_MS = 300;

type Suggestions = {
  items: string[];
  /** 되묻기에 눌러서 답하는 칩인가(패널 제목·보낸 문장 처리만 바뀐다). */
  answer: boolean;
};

/** 최신 답의 칩. 없거나 형식이 다르면 빈 목록(고정 문장을 쓴다). */
function latestSuggestions(messages: ChatMessage[]): Suggestions {
  const last = [...messages].reverse().find(message => message.role === 'assistant');
  const raw = last?.suggestedQuestions;
  if (!Array.isArray(raw)) return { items: [], answer: false };
  const items = [
    ...new Set(
      raw
        .filter((q): q is string => typeof q === 'string')
        .map(q => q.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SUGGESTED);
  return { items, answer: items.length > 0 && last?.suggestedKind === ANSWER_KIND };
}

/**
 * 보호자: 예약 칩은 항상 맨 앞(누른 뒤에도 남긴다), 그 뒤에 이어질 질문(없으면 고정 문장).
 * 이 대화창에서 이미 보낸 문장은 뺀다. 되묻기 답 칩은 빼지 않는다(다른 증상에도 같은 답을 고를 수 있다).
 */
function guardianPrompts({ items: suggested, answer }: Suggestions, sent: ReadonlySet<string>): GuardianPrompt[] {
  const booking = GUARDIAN_PROMPTS[0];
  const unsent = suggested.filter(text => text !== booking.text && (answer || !sent.has(text)));
  const rest =
    unsent.length > 0 ? unsent.map(text => ({ text })) : GUARDIAN_PROMPTS.slice(1).filter(p => !sent.has(p.text));
  return [booking, ...rest];
}

/**
 * 피보호자: 답에 딸린 칩(되묻기 답 칩·이어질 질문)이 있으면 그것만 - 상관없는 기본 증상으로 채우지 않는다(2026-11-02).
 * 없으면 기본 문장. 이미 보낸 문장은 빼므로 칸 수가 줄 수 있다(되묻기 답 칩은 빼지 않는다).
 * 기본 문장까지 다 보냈으면 기본 문장을 처음부터 다시 보인다 - 패널이 빈 채로 남지 않게(2026-11-11 사용자 결정).
 */
function wardPrompts({ items: suggested, answer }: Suggestions, sent: ReadonlySet<string>) {
  const related = suggested.filter(text => answer || !sent.has(text)).map(text => ({ text, suggested: true }));
  if (related.length > 0) return related;
  const unsent = WARD_PROMPTS.filter(text => !sent.has(text));
  return (unsent.length > 0 ? unsent : WARD_PROMPTS).map(text => ({ text, suggested: false }));
}

const COMPOSER_MAX_LINES = 2;
// 피보호자 챗봇은 말한 뒤 3초 조용하면 녹음을 끝내고 바로 보낸다(2026-11-11 사용자 결정 - 말벗은 1.5초 그대로)
const WARD_SILENCE_STOP_MS = 3_000;

interface ChatbotContentProps {
  /**
   * 보호자 화면은 상담 기록·추천 질문 칩을 제공한다(상담 대상 선택 칸은 없다 - 예약 때 AI가 대상을 묻는다).
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
  // 피보호자 목록은 상담 기록의 대상 이름 표시에만 쓴다. 요청은 기본으로 wardId 없이 보내고(본인 상담),
  // 예약 대상은 AI 질문의 선택지로 고른다 - 목록을 못 받아도 상담을 잠그지 않는다(BE가 guardianWards를 서버 값으로 채운다).
  const { activeWards } = useGuardianActiveWards(isGuardian);
  const [sessionId, setSessionId] = useState(makeSessionId);
  // 대화창(sessionId)마다 이미 보낸 문장 - 빠른 질문에서 뺀다. 대화와 함께 탭 저장소에 둔다(아래 conversation 저장).
  const [sentBySession, setSentBySession] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);
  // 메뉴를 오가도 대화가 이어지게 탭 저장소(sessionStorage)에 사용자·역할별로 둔다(2026-11-11).
  // 보호자도 대화 하나다 - 대리 예약 턴은 답마다 requestWardId 로 남는다.
  // conversationOwner = 지금 화면의 대화가 어느 키의 것인지(첫 진입 때 저장한 대화를 한 번만 불러온다).
  const accountId = getAccessTokenSubject();
  const conversationId = accountId ? conversationKey(isGuardian ? 'GUARDIAN' : 'WARD', accountId, null) : null;
  const [conversationOwner, setConversationOwner] = useState<string | null>(null);
  // 피보호자별로 나눠 두던 예전 대화(선택 칸이 있던 때)는 탭 저장소에서 지운다
  useEffect(() => {
    if (!accountId || !isGuardian) return;
    pruneWardConversations('GUARDIAN', accountId, []);
  }, [accountId, isGuardian]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatLogs, setChatLogs] = useState<ChatLogItem[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  // 피보호자 예약 중에는 입력창을 접는다. [직접 써서 답하기]를 누른 대화창(sessionId)에서는 다시 펼친다.
  const [composerOpenedIn, setComposerOpenedIn] = useState<string | null>(null);
  const softKeyboardOpen = useSoftKeyboardOpen();
  // 입력 중이고 화면 키보드가 떠 있을 때만 빠른 질문을 숨긴다(키보드를 내리면 포커스가 남아도 다시 보인다).
  const typingWithKeyboard = composerFocused && softKeyboardOpen;

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendingRef = useRef(sending);
  // 응답이 도착했을 때의 대화창 - 보낸 뒤 대화창이 바뀌었으면(새 대화) 그 응답을 버린다.
  const sessionRef = useRef(sessionId);
  const reservationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  sendingRef.current = sending;
  sessionRef.current = sessionId;
  const welcomeRef = useRef(() => buildWelcomeMessage());
  welcomeRef.current = () => buildWelcomeMessage(profile?.name, isGuardian);

  // 대화 키가 정해지거나 바뀌면(첫 진입·다른 계정) 저장한 대화를 불러오고, 없으면 새 대화창으로 시작한다.
  useEffect(() => {
    if (!conversationId || conversationId === conversationOwner) return;
    const saved = loadConversation(conversationId);
    if (saved) {
      const last = saved.messages[saved.messages.length - 1];
      // 답을 받기 전에 화면을 옮겼으면 그 답은 이 화면에 없다 - 그렇다고 알린다(답은 서버 상담 기록에 남는다)
      const restored =
        last?.role === 'user' && !last.id.startsWith(NAV_MESSAGE_PREFIX)
          ? [
              ...saved.messages,
              {
                id: makeId(),
                role: 'assistant' as const,
                content: '답을 받기 전에 화면을 옮겨서 답을 보여 드리지 못했어요. 다시 물어봐 주세요.',
                timestamp: new Date().toISOString(),
                failed: true,
              },
            ]
          : saved.messages;
      setSessionId(saved.sessionId);
      setSentBySession({ [saved.sessionId]: saved.sent });
      setMessages(restored);
    } else if (conversationOwner !== null) {
      setSessionId(makeSessionId());
      setSentBySession({});
      setMessages([welcomeRef.current()]);
    }
    setConversationOwner(conversationId);
  }, [conversationId, conversationOwner]);

  // 대화가 바뀔 때마다 저장한다. 첫 인사만 있으면 저장하지 않는다(새 대화·아직 묻지 않음).
  useEffect(() => {
    if (!conversationOwner || conversationOwner !== conversationId) return;
    if (!messages.some(message => message.id !== 'welcome')) return;
    saveConversation(conversationOwner, { sessionId, messages, sent: sentBySession[sessionId] ?? [] });
  }, [conversationId, conversationOwner, messages, sessionId, sentBySession]);

  // 피보호자 화면은 마이크로만 입력한다(2026-11-11). 받아쓰기·권한이 실패했을 때만 [글자로 쓰기]로 입력창을 연다
  const typingOpen = isWardChat && composerOpenedIn === sessionId;
  const sendVoiceRef = useRef<(text: string) => void>(() => undefined);
  // 말로 입력: 보호자(또는 피보호자가 입력창을 연 경우)는 받은 글자를 입력창에만 채운다(자동 전송 안 함).
  // 쓰던 글이 있으면 한 칸 띄워 뒤에 붙인다. 피보호자 마이크 전용 화면은 받은 글자를 바로 보낸다(보낸 말풍선으로 확인).
  // 대화창이 바뀌면 cancel()로 버린다.
  const voice = useVoiceInput(
    text => {
      if (isWardChat && !typingOpen) {
        sendVoiceRef.current(text);
        return;
      }
      setInput(prev => (prev.trim() ? `${prev.trimEnd()} ${text}` : text));
    },
    isWardChat ? { silenceMs: WARD_SILENCE_STOP_MS } : undefined,
  );

  useEffect(() => {
    if (!profile) return;

    setMessages(prev => {
      if (prev.length !== 1 || prev[0].id !== 'welcome') return prev;
      return [buildWelcomeMessage(profile.name, isGuardian)];
    });
  }, [isGuardian, profile]);

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
    // box-sizing: border-box라 높이에 테두리도 들어간다. scrollHeight는 테두리를 빼고 재므로 더해 줘야
    // 글자 위아래 여백이 같아진다(빼먹으면 테두리만큼 낮아져 '직접 쓰기'가 위로 붙었다)
    const borders = (Number.parseFloat(computedStyle.borderTopWidth) || 0) + (Number.parseFloat(computedStyle.borderBottomWidth) || 0);
    const maxHeight = lineHeight * COMPOSER_MAX_LINES + paddingTop + paddingBottom;

    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight) + borders}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant');
  const lastAssistantId = lastAssistant?.id;
  // 예약 진행 중(마지막 답이 예약 단계 선택지) - "눌러서 물어보세요" 칩 대신 선택지를 패널에 크게 보인다.
  // 완료(예약 목록 보기 / 계속 상담하기)·취소 답이 오면 풀려 칩이 돌아온다. 보내기 실패 안내는 건너뛰어
  // 직전 단계 선택지를 그대로 둔다 - 지난 선택지는 말풍선에 없어 다시 누를 길이 사라진다(2026-11-04 점검 🟡).
  const stepSource = [...messages].reverse().find(message => message.role === 'assistant' && !message.failed);
  const reserving = isReservationStep(stepSource);
  const reservationUi = reserving ? stepSource?.ui : undefined;
  const showComposer = !isWardChat || typingOpen;
  // 피보호자는 받아쓴 글을 바로 보낸다 - 녹음·변환 중에 칩·선택지를 누르면 두 질문이 나가거나(칩 → 받아쓴 글)
  // 답을 기다리는 사이 받아쓴 글이 버려진다. 그동안은 칩·예약 선택지를 잠근다(2026-11-11 기능 점검 F-1)
  const wardVoiceBusy = isWardChat && voice.state !== 'idle';
  // 피보호자: 마지막 답(실패 안내 제외)이 응급·위기면 빠른 질문 대신 큰 119 버튼을 둔다. 다음 답이 응급이 아니면 돌아온다.
  // 판정은 말풍선 긴급 상자와 같다(chatUrgency - 문구·이모지는 보지 않는다). 예약 진행 패널이 먼저다.
  const wardUrgent = isWardChat && !reserving && !!stepSource && isUrgentAnswer(stepSource);
  const suggested = latestSuggestions(messages);
  const quickTitle = suggested.answer ? '눌러서 답해 보세요' : '눌러서 물어보세요';
  // 보호자 글·칩 입력에 이어 실을 피보호자(대리 예약 중일 때만 - reservationFlow.textWardId)
  const carriedWardId = isGuardian ? textWardId(stepSource) : undefined;
  const sentTexts = new Set(sentBySession[sessionId] ?? []);
  // 서버는 버튼·날짜·지역 선택도 "[선택] field: value" 형식의 별도 기록으로 남긴다.
  // 이는 실제 상담 시작점이 아니므로 내 상담 기록 목록에서는 제외한다.
  const send = useCallback(
    async (
      text: string,
      uiSelection?: { field: string; value: string },
      uiSelectionLabel?: string,
      refocusComposer = false,
      wardId?: string,
    ) => {
      const trimmed = text.trim();
      if (!trimmed && !uiSelection) return;
      if (sendingRef.current) return;

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        // 선택지의 value(show_list·__type__·예약 ID)는 보이지 않고 label 만 보인다.
        content: uiSelection ? selectionText(uiSelection.value, uiSelectionLabel) : trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setSending(true);
      setFallback(false);

      try {
        // 환자 정보(이름·전화·생년월일·나이·성별·주소)는 보내지 않는다 - 백엔드가 로그인 사용자 또는 검증한
        // 피보호자의 DB 값으로 채우고 클라이언트 값은 버린다(BE #440·#444). 대리 예약은 피보호자 ID만 보낸다.
        // 보호자는 기본으로 wardId 없이(본인 상담), 예약 대상을 고른 뒤 예약이 끝날 때까지만 싣는다(계약 ③).
        const role = getAuthRole() ?? undefined;
        const requestWardId = isGuardian && wardId ? wardId : undefined;
        const context = requestWardId ? { role: 'GUARDIAN', wardId: requestWardId } : { role };

        // 대화 맥락은 AI가 같은 sessionId의 서버 기록으로 만든다 - 이력은 보내지 않는다(2026-10-29, AI #91).
        const result = await sendChatMessage({
          message: uiSelection ? undefined : trimmed,
          sessionId,
          context,
          uiSelection: uiSelection ?? undefined,
        });
        // 기다리는 사이 대화창이 바뀌었으면(새 대화) 버린다 - 앞 대화의 선택지가 새 대화에 붙지 않게(점검 🟠).
        if (sessionRef.current !== sessionId) return;

        setMessages(prev => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: result.reply,
            timestamp: new Date().toISOString(),
            requestWardId,
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
            suggestedKind: result.suggestedKind,
            layout: result.layout ?? null,
          },
        ]);

        // 답을 받은 문장만 기억한다 - 보내기에 실패한 문장은 다시 누를 수 있게 버튼에 남긴다.
        if (!uiSelection) {
          setSentBySession(prev => ({ ...prev, [sessionId]: [...(prev[sessionId] ?? []), trimmed] }));
        }

        if (result.engine === 'fallback') setFallback(true);
      } catch (error) {
        if (sessionRef.current !== sessionId) return;
        setMessages(prev => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: getChatErrorMessage(error),
            timestamp: new Date().toISOString(),
            failed: true,
          },
        ]);
      } finally {
        setSending(false);
        // 입력창에서 보낸 경우에만 되돌린다. 빠른 질문·선택지를 누른 뒤 포커스를 옮기면
        // 휴대폰 키보드가 올라와 대화를 가리고, 피보호자 화면은 빠른 질문 칸까지 숨겨진다.
        if (refocusComposer) textareaRef.current?.focus();
      }
    },
    [isGuardian, sessionId],
  );

  useEffect(() => {
    sendVoiceRef.current = text => void send(text);
  }, [send]);

  useEffect(
    () => () => {
      if (reservationTimerRef.current) clearTimeout(reservationTimerRef.current);
    },
    [],
  );

  // AI를 부르지 않으므로 챗 기록에 저장되지 않고, 보낸 문장 기억에도 넣지 않는다.
  // 병원 가는 날 화면은 전역으로 고른 피보호자(selectedWardStore)로 열린다
  function leaveTo(text: string, path: string) {
    if (sendingRef.current || reservationTimerRef.current) return;
    // AI에 보내지 않는 말풍선 - 돌아왔을 때 "답을 받기 전에 옮겼다"로 잘못 알리지 않게 표시한다
    setMessages(prev => [...prev, { id: `${NAV_MESSAGE_PREFIX}${makeId()}`, role: 'user', content: text, timestamp: new Date().toISOString() }]);
    reservationTimerRef.current = setTimeout(() => {
      reservationTimerRef.current = null;
      router.push(path);
    }, RESERVATION_NAV_DELAY_MS);
  }

  /**
   * 대리 예약 답의 [예약 목록 보기]는 그 피보호자의 목록이어야 한다(계약 ③ 버튼 규칙) - 그 답을 받은 요청의
   * wardId 로 전역 선택을 맞춘 뒤 옮긴다. 본인 답이면 전역 선택을 건드리지 않는다.
   */
  function openVisitList(text = '예약 목록 보기', wardId?: string) {
    if (sendingRef.current || reservationTimerRef.current) return;
    if (isGuardian && wardId) setSelectedWardId(wardId);
    leaveTo(text, isWardChat ? WARD_VISIT_LIST_PATH : GUARDIAN_VISIT_LIST_PATH);
  }

  /** 새 대화창으로 처음부터 - 예약 초안은 대화창(sessionId)마다 AI가 들고 있어 함께 비워진다. */
  /** 화면 이동 대기 중에 대화를 바꾸면 이동을 취소한다. */
  function cancelPendingNavigation() {
    if (reservationTimerRef.current) clearTimeout(reservationTimerRef.current);
    reservationTimerRef.current = null;
  }

  function restartConversation() {
    if (sendingRef.current) return;
    cancelPendingNavigation();
    voice.cancel();
    if (conversationOwner) removeConversation(conversationOwner);
    setSessionId(makeSessionId());
    setSentBySession({});
    setMessages([buildWelcomeMessage(profile?.name, isGuardian)]);
    setInput('');
    setFallback(false);
  }

  /** [새 대화] - 주고받은 대화가 있으면 한 번 묻는다(지난 대화는 서버 상담 기록에 남는다). */
  function handleNewConversation() {
    if (sendingRef.current) return;
    const hasConversation = messages.some(message => message.id !== 'welcome');
    if (hasConversation && !window.confirm('지금 대화를 닫고 새로 시작할까요?')) return;
    restartConversation();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input, undefined, undefined, true, carriedWardId);
    }
  }

  /** source = 그 선택지·버튼이 달린 답. 보호자는 그 답을 받은 요청의 wardId 를 이어 싣는다(계약 ③). */
  function handleUiSelect(field: string, value: string, label: string | undefined, source: ChatMessage | undefined) {
    if (wardVoiceBusy) return;
    const wardId = isGuardian ? buttonWardId(field, value, source) : undefined;
    if (isShowList(field, value)) {
      openVisitList(label, wardId);
      return;
    }
    void send('', { field, value }, label, false, wardId);
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
            onUiSelect={(field, value, label) => handleUiSelect(field, value, label, message)}
            onShowList={() => openVisitList(undefined, message.requestWardId)}
            onRestart={restartConversation}
            // 예약 단계 선택지는 지금 단계면 아래 패널에, 지난 단계면 내 말풍선(고른 답)으로 이미 보이므로 말풍선에 그리지 않는다
            hidePrompt={isReservationStep(message)}
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

  // 음성 입력 안내(권한·못 알아들음·오류). 대화 말풍선이 아니라 입력창 아래 한 줄로 보인다
  const voiceNotice = (
    <p className={styles.voiceNotice} role="status" aria-live="polite">
      {voice.state === 'recording'
        ? isWardChat && !typingOpen
          ? '듣고 있어요. 말씀을 마치면 저절로 보내요.'
          : '말씀하세요. 다 하셨으면 다시 눌러 주세요.'
        : voice.state === 'uploading' && isWardChat
          ? '말씀을 글로 바꾸는 중이에요.'
          : (voice.notice ?? '')}
    </p>
  );

  // 피보호자: 큰 마이크 버튼만. 권한 거부·받아쓰기 실패 안내가 떠 있을 때만 [글자로 쓰기]를 보인다
  const composer = !showComposer ? (
    <footer className={`${styles.composer} ${styles.composerCollapsed}`}>
      <VoiceInputButton
        variant="wide"
        state={voice.state}
        elapsedSec={voice.elapsedSec}
        disabled={sending}
        onToggle={voice.toggle}
      />
      {voiceNotice}
      {voice.notice && voice.state === 'idle' && (
        <button type="button" className={styles.composerOpenButton} onClick={() => setComposerOpenedIn(sessionId)}>
          글자로 쓰기
        </button>
      )}
    </footer>
  ) : (
    <footer className={styles.composer}>
      <div className={styles.inputWrap}>
        <VoiceInputButton
          state={voice.state}
          elapsedSec={voice.elapsedSec}
          disabled={sending}
          onToggle={voice.toggle}
        />
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          aria-label="궁금한 점 입력"
          placeholder={isWardChat ? '직접 쓰기' : '여기에 궁금한 점을 써 주세요'}
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
          onClick={() => void send(input, undefined, undefined, true, carriedWardId)}
        >
          보내기
        </button>
      </div>
      {voiceNotice}
    </footer>
  );

  const reservationPanel = (panelVariant: 'guardian' | 'ward') =>
    reservationUi && (
      <section
        className={`${panelVariant === 'ward' ? styles.wardQuickPanel : styles.quickPromptPanel} ${styles.reservationPanel}`}
        aria-label="예약 진행"
      >
        <p className={panelVariant === 'ward' ? styles.wardQuickTitle : styles.quickPromptTitle}>병원 예약 중이에요</p>
        <ChatUiPrompt
          key={stepSource?.id}
          ui={reservationUi}
          active={!wardVoiceBusy}
          onSelect={(field, value, label) => handleUiSelect(field, value, label, stepSource)}
          variant={panelVariant}
          onRestart={restartConversation}
        />
      </section>
    );

  // 상담 기록 창 - 보호자·피보호자 화면 모두(피보호자 버튼 2026-11-11)
  const historyDialog = historyOpen && (
    <ChatHistoryDialog
      logs={chatLogs}
      loading={isLogsLoading}
      error={logsError}
      onClose={() => setHistoryOpen(false)}
      userImageUrl={profile?.profileImage}
      userName={profile?.name}
      variant={isWardChat ? 'ward' : 'guardian'}
      wards={isGuardian ? activeWards.map(ward => ({ id: ward.partnerUserId, name: ward.partnerName })) : undefined}
    />
  );

  if (isWardChat) {
    const wardQuickPrompts = wardPrompts(suggested, sentTexts);
    return (
      <div className={`${styles.chatPage} ${styles.wardVariant}`}>
        <section className={styles.shell}>
          <div className={styles.wardTitleRow}>
            <h1 className={styles.wardTitle}>AI 의료 챗봇</h1>
            <div className={styles.wardTitleActions}>
              <button type="button" className={styles.wardNewChatButton} onClick={() => void handleOpenHistory()}>
                상담 기록
              </button>
              <button type="button" className={styles.wardNewChatButton} onClick={handleNewConversation} disabled={sending}>
                새 대화
              </button>
            </div>
          </div>
          <div className={`${styles.wardBody} ${typingWithKeyboard ? styles.typingWithKeyboard : ''}`}>
            <div className={styles.wardChatCard}>
              {board}
              {composer}
            </div>

            {reserving ? (
              reservationPanel('ward')
            ) : wardUrgent ? (
              <section className={`${styles.wardQuickPanel} ${styles.wardEmergencyPanel}`} aria-label="119 전화">
                <p className={styles.wardEmergencyTitle}>지금 바로 119에 전화하세요</p>
                <a className={styles.wardEmergencyCall} href="tel:119">
                  <Icon name="phone" size={40} decorative />
                  119에 전화하기
                </a>
                <p className={styles.wardEmergencyHint}>전화가 어려우면 가까운 사람에게 도움을 청하세요.</p>
              </section>
            ) : (
              <section className={styles.wardQuickPanel} aria-label="추천 질문">
                <p className={styles.wardQuickTitle}>{quickTitle}</p>
                <div className={styles.wardQuickGrid}>
                  {wardQuickPrompts.map(prompt => (
                    <button
                      key={prompt.text}
                      type="button"
                      className={styles.wardQuickButton}
                      disabled={sending || wardVoiceBusy}
                      onClick={() => void send(prompt.text)}
                    >
                      <span className={styles.wardQuickIcon} aria-hidden="true">
                        <Icon name={prompt.suggested ? 'message' : 'alert'} size={28} decorative />
                      </span>
                      <span>{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
        {historyDialog}
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
            <button
              type="button"
              className={styles.historyButton}
              onClick={handleNewConversation}
              disabled={sending}
            >
              새 대화
            </button>
            <button type="button" className={styles.historyButton} onClick={() => void handleOpenHistory()}>
              <Icon name="message" size={16} decorative />
              상담 기록
            </button>
          </div>
        </header>

        <div className={`${styles.body} ${typingWithKeyboard ? styles.typingWithKeyboard : ''}`}>
          {board}

          {reserving ? (
            reservationPanel('guardian')
          ) : (
            <section className={styles.quickPromptPanel} aria-label="추천 질문">
              <p className={styles.quickPromptTitle}>{quickTitle}</p>
              <div className={styles.quickPromptRow}>
                {guardianPrompts(suggested, sentTexts).map(prompt => (
                  <button
                    key={prompt.text}
                    type="button"
                    className={`${styles.quickPromptButton} ${prompt.primary ? styles.quickPromptPrimary : ''}`}
                    disabled={sending}
                    onClick={() => void send(prompt.text, undefined, undefined, false, carriedWardId)}
                  >
                    {prompt.primary && <Icon name="calendar" size={18} decorative />}
                    {prompt.text}
                  </button>
                ))}
              </div>
            </section>
          )}

          {composer}
        </div>
      </section>

      {historyDialog}
    </div>
  );
}
