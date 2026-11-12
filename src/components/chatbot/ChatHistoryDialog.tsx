'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatLogItem } from '@/service/interface/chat';
import ChatBubble from './ChatBubble';
import { CloseIcon } from './chatIcons';
import { RESERVATION_INTENT } from './reservationFlow';
import { groupChatSessions, logToMessages, type ChatHistorySession } from './chatHistorySessions';
import styles from './ChatHistoryDialog.module.css';

interface Props {
  logs: ChatLogItem[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  variant?: 'guardian' | 'ward';
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

/** 피보호자 목록의 날짜·시각 두 줄("오늘" / "오전 10:20", "11월 10일" / "오후 3:05"). */
function wardLogDate(value?: string): [string, string] | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const dayKey = (d: Date) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeZone: 'Asia/Seoul' }).format(d);
  const day =
    dayKey(date) === dayKey(new Date())
      ? '오늘'
      : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(date);
  const time = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(date);
  return [day, time];
}

/** 예약을 다룬 대화창인가(기록의 의도 값 - 문구는 보지 않는다). */
function isReservationSession(session: ChatHistorySession) {
  return session.logs.some(log => log.intent === RESERVATION_INTENT);
}

/** 내 상담 기록 - 대화창 단위 목록, 누르면 그 대화의 질문·답 전체(2026-11-11). */
export default function ChatHistoryDialog({
  logs,
  loading,
  error,
  onClose,
  variant = 'guardian',
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 열면 [닫기]로 포커스를 옮기고, Escape로 닫으며, 닫히면 연 버튼으로 포커스를 돌려준다(2026-11-12 기능 점검 - 키보드·화면 읽기 사용자가 창 밖에 남지 않게).
  // Tab·Shift+Tab은 창 안에서만 돈다 - 뒤에 깔린 챗봇 화면으로 빠져나가지 않게
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${variant === 'ward' ? styles.wardDialog : ''}`}
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
          {variant === 'ward' ? (
            // 피보호자: 글자 "닫기"가 보이는 큰 버튼(화면 읽기 이름은 그대로 "상담 기록 닫기")
            <button ref={closeRef} type="button" className={styles.wardCloseButton} onClick={onClose} aria-label="상담 기록 닫기">
              <CloseIcon size={24} />
              닫기
            </button>
          ) : (
            <button ref={closeRef} type="button" className={styles.closeButton} onClick={onClose} aria-label="상담 기록 닫기">
              ×
            </button>
          )}
        </header>

        {opened ? (
          <SessionDetail session={opened} variant={variant} />
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
              shown.map(session => {
                if (variant === 'ward') {
                  const when = wardLogDate(session.startedAt);
                  const reservation = isReservationSession(session);
                  return (
                    <button
                      key={session.key}
                      type="button"
                      className={styles.wardItem}
                      onClick={() => setOpenKey(session.key)}
                    >
                      <time className={styles.wardItemDate} dateTime={session.startedAt}>
                        {when ? (
                          <>
                            {when[0]}{' '}
                            <br />
                            {when[1]}
                          </>
                        ) : (
                          '-'
                        )}
                      </time>
                      <strong className={styles.wardItemTitle}>{session.title}</strong>
                      <span className={`${styles.wardItemTag} ${reservation ? styles.wardItemTagReserve : ''}`}>
                        {reservation ? '예약' : '상담'}
                      </span>
                      <span className={styles.wardItemMore}>보기 ›</span>
                    </button>
                  );
                }
                return (
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
                );
              })
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
}: {
  session: ChatHistorySession;
  variant: 'guardian' | 'ward';
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
          variant={variant}
        />
      ))}
    </div>
  );
}
