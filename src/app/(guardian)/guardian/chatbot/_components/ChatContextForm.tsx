'use client';

import { useState } from 'react';
import type { ChatContext } from '@/service/interface/chat';
import styles from './ChatContextForm.module.css';

interface Props {
  value: ChatContext;
  onChange: (ctx: ChatContext) => void;
}

export default function ChatContextForm({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function set<K extends keyof ChatContext>(field: K, v: ChatContext[K]) {
    onChange({ ...value, [field]: v });
  }

  const filledCount = Object.values(value).filter(Boolean).length;

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>상담 컨텍스트</span>
        {filledCount > 0 && <span className={styles.badge}>{filledCount}개 입력됨</span>}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>나이</span>
            <input
              type="number"
              placeholder="예: 72"
              value={value.age ?? ''}
              onChange={e => set('age', e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
          <label className={styles.field}>
            <span>성별</span>
            <select value={value.gender ?? ''} onChange={e => set('gender', e.target.value)}>
              <option value="">선택 안 함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>지역</span>
            <input
              placeholder="예: 서울 강남구"
              value={value.location ?? ''}
              onChange={e => set('location', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>이름</span>
            <input
              placeholder="피보호자 이름"
              value={value.name ?? ''}
              onChange={e => set('name', e.target.value)}
            />
          </label>
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>연락처</span>
            <input
              placeholder="010-0000-0000"
              value={value.phone ?? ''}
              onChange={e => set('phone', e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
