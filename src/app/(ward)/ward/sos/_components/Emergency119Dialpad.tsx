'use client';

import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import styles from './Emergency119Dialpad.module.css';

const cx = classNames.bind(styles);

// 학생 프로젝트라 실제 신고가 나가면 안 된다(2026-08-26). 휴대폰 다이얼러를 여는 전화 링크·OS 다이얼러 호출을
// 쓰지 않고 앱 안에서 그린 키패드만 쓴다 - 통화 버튼은 안내만 띄운다(Emergency119Dialpad.browser.test.tsx 가드)
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

export function Emergency119Dialpad({
  guardianNotified,
  onClose,
}: {
  guardianNotified?: boolean;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('119');
  const [callNoticeShown, setCallNoticeShown] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const callNoticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
      tabIndex={-1}
    >
      <div className={cx('screen')}>
        <div className={cx('header')}>
          <p className={cx('notice')}>학생 프로젝트 화면 · 실제로 신고 전화가 발신되지 않습니다</p>
          <button className={cx('close')} type="button" onClick={onClose} aria-label="119 화면 닫기">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span>닫기</span>
          </button>
        </div>

        {guardianNotified && <p className={cx('guardianNotice')}>보호자에게도 알렸어요</p>}

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
