'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import styles from './Emergency119Dialpad.module.css';

const cx = classNames.bind(styles);

// 학생 프로젝트라 실제 신고가 나가면 안 된다(2026-08-26). 휴대폰 다이얼러를 여는 전화 링크·OS 다이얼러 호출을
// 쓰지 않고 앱 안에서 그린 키패드만 쓴다 - 통화 버튼은 안내만 띄운다(Emergency119Dialpad.guard.test.ts 가드)
const DIAL_KEYS: { key: string; letters?: string }[] = [
  { key: '1' },
  { key: '2', letters: 'ABC' },
  { key: '3', letters: 'DEF' },
  { key: '4', letters: 'GHI' },
  { key: '5', letters: 'JKL' },
  { key: '6', letters: 'MNO' },
  { key: '7', letters: 'PQRS' },
  { key: '8', letters: 'TUV' },
  { key: '9', letters: 'WXYZ' },
  { key: '*' },
  { key: '0', letters: '+' },
  { key: '#' },
];

const MAX_DIGITS = 15;

export const DEMO_CALL_NOTICE = '시연 화면이라 실제로 전화가 걸리지 않아요';
// onCall(보호자 알림)을 받을 때의 상태 안내 - 챗봇 119 버튼이 쓴다
export const CALL_SENDING_NOTICE = '보호자에게 알리는 중이에요…';
export const CALL_SUCCESS_NOTICE = '보호자에게 알렸어요. 시연 화면이라 119에는 실제로 걸리지 않아요';
// 챗봇 위기 답의 109(자살예방 상담전화) 키패드 - 119와 같이 실제로 걸지 않는다(2026-11-20)
export const CALL_SUCCESS_NOTICE_109 = '보호자에게 알렸어요. 시연 화면이라 109에는 실제로 걸리지 않아요';

/** 키패드가 처음 띄울 번호. 119 = 긴급 신고, 109 = 자살예방 상담전화(챗봇 위기 답) */
export type EmergencyDialNumber = '119' | '109';

const DIAL_TEXT: Record<EmergencyDialNumber, { dialog: string; close: string; notice: string; callWithNotify: string }> = {
  '119': {
    dialog: '119 신고 키패드(시연 화면)',
    close: '119 화면 닫기',
    notice: '학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다',
    callWithNotify: '통화(보호자에게 알림 - 실제로 119에 걸리지 않음)',
  },
  '109': {
    dialog: '109 자살예방 상담전화 키패드(시연 화면)',
    close: '109 화면 닫기',
    notice: '학생 프로젝트 화면 · 실제로 상담 전화가 발신되지 않습니다',
    callWithNotify: '통화(보호자에게 알림 - 실제로 109에 걸리지 않음)',
  },
};
export const CALL_FAILED_NOTICE = '보호자에게 알리지 못했어요. 통화 버튼을 다시 눌러 주세요.';
export const CALL_OFFLINE_NOTICE = '인터넷이 끊겨 보호자에게 알리지 못했어요. 연결되면 통화 버튼을 다시 눌러 주세요.';

type CallState = 'idle' | 'sending' | 'success' | 'failed';

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// 키패드 위에 다른 모달(전송 실패 안내 등)이 떠 있으면 Tab 순환은 그 모달에 맡긴다
function isTopModal(dialog: HTMLElement) {
  const modals = document.querySelectorAll('[aria-modal="true"]');
  return modals[modals.length - 1] === dialog;
}

interface Emergency119DialpadProps {
  onClose: () => void;
  /** 통화 버튼이 보호자 알림을 보낼 때 넘긴다. 없으면 안내 문구만 띄운다(SOS 화면). */
  onCall?: () => Promise<unknown>;
  /** 안내 문구 아래에 둘 내용(자살예방 상담전화 안내 등) */
  footer?: ReactNode;
  /** 알림 성공 문구를 바꿀 때(연결된 보호자가 없을 때 등). 없으면 번호에 맞는 기본 문구 */
  successNotice?: string;
  /** 처음 띄울 번호(기본 119). 109여도 전화 링크·OS 다이얼러는 쓰지 않는다 */
  number?: EmergencyDialNumber;
}

export function Emergency119Dialpad({ onClose, onCall, footer, successNotice, number = '119' }: Emergency119DialpadProps) {
  const text = DIAL_TEXT[number];
  const resolvedSuccessNotice = successNotice ?? (number === '109' ? CALL_SUCCESS_NOTICE_109 : CALL_SUCCESS_NOTICE);
  const [digits, setDigits] = useState<string>(number);
  const [callNoticeShown, setCallNoticeShown] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  // 상태값은 렌더 뒤에야 바뀌어 연타를 못 막는다 - ref 로 먼저 잠근다
  const callLockRef = useRef(false);
  const mountedRef = useRef(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const callNoticeRef = useRef<HTMLParagraphElement>(null);
  const noticeId = useId();

  useEffect(() => {
    // 닫으면 열기 전 포커스(보통 SOS 버튼)로 돌려보낸다
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog || !isTopModal(dialog)) return;

      // 포커스 가둠 - 뒤에 가려진 SOS 버튼으로 빠져 SOS가 한 번 더 나가지 않게 한다
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active) || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleCall() {
    if (!onCall) {
      setCallNoticeShown(true);
      return;
    }
    // 보내는 중이거나 이미 알렸으면 다시 보내지 않는다(보호자에게 같은 알림이 겹치지 않게)
    if (callLockRef.current || callState === 'success') return;
    callLockRef.current = true;
    setCallState('sending');
    try {
      await onCall();
      if (mountedRef.current) setCallState('success');
    } catch {
      callLockRef.current = false;
      if (mountedRef.current) setCallState('failed');
    }
  }

  const callNoticeText = !onCall
    ? callNoticeShown
      ? DEMO_CALL_NOTICE
      : ''
    : callState === 'sending'
      ? CALL_SENDING_NOTICE
      : callState === 'success'
        ? resolvedSuccessNotice
        : callState === 'failed'
          ? typeof navigator !== 'undefined' && navigator.onLine === false
            ? CALL_OFFLINE_NOTICE
            : CALL_FAILED_NOTICE
          : '';
  const noticeVisible = callNoticeText !== '';

  // 작은 화면·큰 글씨에서는 안내가 통화 버튼 아래로 밀려 안 보일 수 있어 보이는 곳까지 내린다
  useEffect(() => {
    if (noticeVisible) callNoticeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [noticeVisible, callNoticeText]);

  return (
    <div
      ref={dialogRef}
      className={cx('overlay')}
      role="dialog"
      aria-modal="true"
      aria-label={text.dialog}
      aria-describedby={noticeId}
      tabIndex={-1}
    >
      {/* 2026-11-19(사용자 결정): 아이폰 전화 앱 키패드 모양. 상태 표시줄·아래 탭·연락처 추가 아이콘은 넣지 않고,
          닫기(나갈 방법)와 시연 안내(실제로 걸린다고 믿지 않게)는 남긴다 */}
      <div className={cx('screen')}>
        <div className={cx('header')}>
          <button className={cx('close')} type="button" onClick={onClose} aria-label={text.close}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span>닫기</span>
          </button>
        </div>

        <div className={cx('top')}>
          {/* 숫자 위 한 줄 - 평소에는 시연 안내, 통화 버튼을 누른 뒤에는 그 결과(같은 자리) */}
          <div className={cx('noticeSlot')}>
            <p id={noticeId} className={cx('notice', { hidden: noticeVisible })}>
              {text.notice}
            </p>
            <p
              ref={callNoticeRef}
              className={cx('callNotice', { visible: noticeVisible })}
              role="status"
              aria-live="polite"
            >
              {callNoticeText}
            </p>
          </div>
          <output className={cx('display')} aria-label="입력된 번호">
            {digits || ' '}
          </output>
        </div>

        <div className={cx('pad')}>
          {DIAL_KEYS.map(({ key, letters }) => (
            <button
              key={key}
              type="button"
              className={cx('key')}
              aria-label={key === '*' ? '별표' : key === '#' ? '샵' : key}
              onClick={() => setDigits(prev => (prev + key).slice(0, MAX_DIGITS))}
            >
              <span className={cx('keyDigit', { symbol: key === '*' || key === '#' })}>{key}</span>
              {letters && <span className={cx('keyLetters', { plus: letters === '+' })}>{letters}</span>}
            </button>
          ))}

          <span className={cx('padSpacer')} aria-hidden="true" />
          <button
            className={cx('callButton')}
            type="button"
            onClick={() => void handleCall()}
            disabled={callState === 'sending'}
            aria-busy={callState === 'sending' || undefined}
            aria-label={onCall ? text.callWithNotify : '통화(시연 화면 - 실제로 걸리지 않음)'}
          >
            <svg viewBox="0 0 24 24" width="46%" height="46%" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02z"
              />
            </svg>
          </button>
          <button
            className={cx('backspace', { hidden: !digits })}
            type="button"
            onClick={() => setDigits(prev => prev.slice(0, -1))}
            aria-label="한 글자 지우기"
            disabled={!digits}
          >
            <svg viewBox="0 0 34 24" width="34" height="24" aria-hidden="true" focusable="false">
              <path d="M11 1.5h19a2.5 2.5 0 0 1 2.5 2.5v16a2.5 2.5 0 0 1-2.5 2.5H11L1.5 12z" fill="currentColor" />
              <path d="M15.5 7.5l9 9M24.5 7.5l-9 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {footer}
      </div>
    </div>
  );
}
