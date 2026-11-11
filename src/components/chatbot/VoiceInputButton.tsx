'use client';

import type { VoiceInputState } from './useVoiceInput';
import styles from './VoiceInputButton.module.css';

type Props = {
  state: VoiceInputState;
  elapsedSec: number;
  disabled?: boolean;
  onToggle: () => void;
  /** compact: 입력창 옆(아이콘+짧은 글), wide: 접힌 입력창 자리(글 포함) */
  variant?: 'compact' | 'wide';
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
export default function VoiceInputButton({ state, elapsedSec, disabled, onToggle, variant = 'compact' }: Props) {
  const recording = state === 'recording';
  const uploading = state === 'uploading';

  const label = recording ? '녹음 끝내기' : uploading ? '말씀을 글로 바꾸는 중' : '말로 입력하기';
  const text = recording ? `끝내기 ${elapsedSec}초` : uploading ? '글로 바꾸는 중…' : variant === 'wide' ? '말로 하기' : '말하기';

  return (
    <button
      type="button"
      className={`${styles.button} ${variant === 'wide' ? styles.wide : ''} ${recording ? styles.recording : ''}`}
      onClick={onToggle}
      disabled={uploading || (disabled && !recording)}
      aria-label={label}
      aria-pressed={recording}
    >
      {recording ? <span className={styles.dot} aria-hidden="true" /> : <MicIcon />}
      <span className={styles.text}>{text}</span>
    </button>
  );
}
