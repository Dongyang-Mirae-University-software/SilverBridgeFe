'use client';

import { useState } from 'react';
import type { ChatUiPromptData } from '@/service/interface/chat';
import styles from './ChatUiPrompt.module.css';

interface Props {
  ui: ChatUiPromptData;
  active: boolean;
  onSelect: (field: string, value: string) => void;
}

export default function ChatUiPrompt({ ui, active, onSelect }: Props) {
  const [textVal, setTextVal] = useState('');
  const [dateVal, setDateVal] = useState('');

  function apply(value: string) {
    if (!value.trim() || !active) return;
    onSelect(ui.field, value.trim());
  }

  if (ui.kind === 'select') {
    return (
      <div className={styles.wrap}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.chips}>
          {(ui.options ?? []).map(opt => (
            <button
              key={opt}
              type="button"
              disabled={!active}
              className={styles.chip}
              onClick={() => apply(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        {!active && <p className={styles.inactiveNote}>이전 대화의 선택지입니다.</p>}
      </div>
    );
  }

  if (ui.kind === 'date') {
    return (
      <div className={styles.wrap}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.inputRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={dateVal}
            disabled={!active}
            onChange={e => setDateVal(e.target.value)}
          />
          <button
            type="button"
            className={styles.applyBtn}
            disabled={!active || !dateVal}
            onClick={() => apply(dateVal)}
          >
            적용
          </button>
        </div>
      </div>
    );
  }

  if (ui.kind === 'text') {
    return (
      <div className={styles.wrap}>
        {ui.label && <p className={styles.label}>{ui.label}</p>}
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.textInput}
            value={textVal}
            disabled={!active}
            placeholder={ui.placeholder ?? '입력하세요'}
            onChange={e => setTextVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply(textVal); }}
          />
          <button
            type="button"
            className={styles.applyBtn}
            disabled={!active || !textVal.trim()}
            onClick={() => apply(textVal)}
          >
            적용
          </button>
        </div>
      </div>
    );
  }

  return null;
}
