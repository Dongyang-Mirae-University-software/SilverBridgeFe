'use client';

import type { VoiceInputState } from './useVoiceInput';
import styles from './VoiceInputButton.module.css';

type Props = {
  state: VoiceInputState;
  elapsedSec: number;
  disabled?: boolean;
  onToggle: () => void;
  /** compact: 입력창 옆(아이콘+짧은 글), wide: 접힌 입력창 자리(글 포함), round: 보호자 입력 줄 안의 둥근 아이콘 버튼 */
  variant?: 'compact' | 'wide' | 'round';
  /** wide 의 쉬는 상태 글자("말로 물어보기"·"말로 답하기"·"말로 더 묻기"). 화면 읽기 이름도 같은 글자로 맞춘다 */
  idleText?: string;
  /** wide 를 흰 바탕 테두리 버튼으로 낮춘다(응급 답 뒤 - 119 버튼이 먼저다) */
  quiet?: boolean;
};

function MicIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 눌러서 시작 / 다시 눌러서 끝 (어르신이 길게 누르기 어려워 토글로 둔다)
export default function VoiceInputButton({
  state,
  elapsedSec,
  disabled,
  onToggle,
  variant = 'compact',
  idleText,
  quiet = false,
}: Props) {
  const recording = state === 'recording';
  const uploading = state === 'uploading';

  // wide(피보호자 마이크 전용): 말이 멈추면 저절로 끝나므로 "끝내기"를 보이지 않고 "듣고 있어요"만 둔다(2026-11-11 사용자 요청).
  // 눌러서 바로 끝내는 동작은 그대로 둔다
  const wide = variant === 'wide';
  const wideIdle = idleText ?? '말로 하기';
  const label = recording
    ? wide
      ? '듣고 있어요'
      : '녹음 끝내기'
    : uploading
      ? '말씀을 글로 바꾸는 중'
      : wide && idleText
        ? idleText
        : '말로 입력하기';
  const text = recording
    ? wide
      ? '듣고 있어요'
      : `끝내기 ${elapsedSec}초`
    : uploading
      ? '글로 바꾸는 중…'
      : wide
        ? wideIdle
        : '말하기';
  const variantClass = wide ? styles.wide : variant === 'round' ? styles.round : '';

  return (
    <button
      type="button"
      className={`${styles.button} ${variantClass} ${wide && quiet ? styles.quiet : ''} ${recording ? styles.recording : ''}`}
      onClick={onToggle}
      disabled={uploading || (disabled && !recording)}
      aria-label={label}
      aria-pressed={recording}
    >
      {recording ? <span className={styles.dot} aria-hidden="true" /> : <MicIcon />}
      {/* 둥근 버튼은 아이콘만 - 상태 안내는 입력 줄 아래 한 줄(voiceNotice)이 맡는다 */}
      {variant !== 'round' && <span className={styles.text}>{text}</span>}
    </button>
  );
}
