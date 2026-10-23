'use client';

import { useEffect, useId, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { type GuardianNotifyStatus, useGuardianNotifyStatus } from './guardianNotifyStatus';
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

const GUARDIAN_NOTIFY_TEXT: Record<Exclude<GuardianNotifyStatus, null>, string> = {
  sending: '보호자에게 알리는 중이에요…',
  sent: '보호자에게도 알렸어요',
  failed: '보호자에게 알리지 못했어요',
};

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// 키패드 위에 다른 모달(전송 실패 안내 등)이 떠 있으면 Tab 순환은 그 모달에 맡긴다
function isTopModal(dialog: HTMLElement) {
  const modals = document.querySelectorAll('[aria-modal="true"]');
  return modals[modals.length - 1] === dialog;
}

export function Emergency119Dialpad({ onClose }: { onClose: () => void }) {
  const [digits, setDigits] = useState('119');
  const [callNoticeShown, setCallNoticeShown] = useState(false);
  const guardianNotifyStatus = useGuardianNotifyStatus();
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

  // 작은 화면·큰 글씨에서는 안내가 통화 버튼 아래로 밀려 안 보일 수 있어 보이는 곳까지 내린다
  useEffect(() => {
    if (callNoticeShown) callNoticeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [callNoticeShown]);

  return (
    <div
      ref={dialogRef}
      className={cx('overlay')}
      role="dialog"
      aria-modal="true"
      aria-label="119 신고 키패드(시연 화면)"
      aria-describedby={noticeId}
      tabIndex={-1}
    >
      <div className={cx('screen')}>
        <div className={cx('header')}>
          <p id={noticeId} className={cx('notice')}>
            학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다
          </p>
          <button className={cx('close')} type="button" onClick={onClose} aria-label="119 화면 닫기">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span>닫기</span>
          </button>
        </div>

        {guardianNotifyStatus && (
          <p className={cx('guardianNotice', guardianNotifyStatus)} role="status">
            {GUARDIAN_NOTIFY_TEXT[guardianNotifyStatus]}
          </p>
        )}

        <div className={cx('displayRow')}>
          <span className={cx('displaySpacer')} aria-hidden="true" />
          <output className={cx('display')} aria-label="입력된 번호">
            {digits || ' '}
          </output>
          <button
            className={cx('backspace', { hidden: !digits })}
            type="button"
            onClick={() => setDigits(prev => prev.slice(0, -1))}
            aria-label="한 글자 지우기"
            disabled={!digits}
          >
            <svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true" focusable="false">
              <path
                d="M10 2h18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H10L2 12z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M14 8l8 8M22 8l-8 8" stroke="#1a2530" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
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
              {letters && <span className={cx('keyLetters')}>{letters}</span>}
            </button>
          ))}
        </div>

        <div className={cx('callRow')}>
          <button
            className={cx('callButton')}
            type="button"
            onClick={() => setCallNoticeShown(true)}
            aria-label="통화(시연 화면 - 실제로 걸리지 않음)"
          >
            <Icon name="phone" size={34} decorative />
          </button>
        </div>

        <p
          ref={callNoticeRef}
          className={cx('callNotice', { visible: callNoticeShown })}
          role="status"
          aria-live="polite"
        >
          {callNoticeShown ? DEMO_CALL_NOTICE : ''}
        </p>
      </div>
    </div>
  );
}
