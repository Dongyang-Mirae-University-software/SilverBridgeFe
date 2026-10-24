'use client';

import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { useCreateGuardianInquiryMutation } from '@/service/query/guardian/inquiry';
import { InquiryCategory } from '@/service/interface/guardian/inquiry';
import { INQUIRY_CATEGORY_LABEL } from './GuardianInquiryCard';
import { inquiryErrorMessage } from './inquiryErrorMessage';
import styles from './GuardianInquiryForm.module.css';

const cx = classNames.bind(styles);

const CATEGORIES: InquiryCategory[] = ['ANOMALY', 'HOSPITAL', 'ACCOUNT', 'SERVICE', 'ETC'];

export const TITLE_MAX_LENGTH = 100;
export const CONTENT_MAX_LENGTH = 2000;

interface GuardianInquiryFormProps {
  onCancel: () => void;
  onSubmitted?: () => void;
}

export function GuardianInquiryForm({ onCancel, onSubmitted }: GuardianInquiryFormProps) {
  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createMutation = useCreateGuardianInquiryMutation();
  const submittingRef = useRef(false);

  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isPending = createMutation.isPending;

  const selectCategory = (value: InquiryCategory) => {
    setCategory(value);
    setErrorMessage(null);
  };

  // 라디오 그룹 키보드: 방향키로 이동하며 고르고, Tab은 그룹에 한 번만 멈춘다
  const handleChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const target =
      step != null
        ? (index + step + CATEGORIES.length) % CATEGORIES.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? CATEGORIES.length - 1
            : null;
    if (target == null) return;
    event.preventDefault();
    selectCategory(CATEGORIES[target]);
    chipRefs.current[target]?.focus();
  };
  const canSubmit = Boolean(category) && title.trim().length > 0 && content.trim().length > 0 && !isPending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // isPending은 다음 렌더에야 바뀌므로 같은 순간의 연속 클릭은 ref로 막는다
    if (!category || !canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);

    createMutation.mutate(
      { category, title: title.trim(), content: content.trim() },
      {
        onSuccess: () => onSubmitted?.(),
        onError: error => setErrorMessage(inquiryErrorMessage(error, '문의를 보내지 못했어요. 다시 시도해 주세요.')),
        onSettled: () => {
          submittingRef.current = false;
        },
      },
    );
  };

  return (
    <form className={cx('form')} onSubmit={handleSubmit} aria-label="새 문의 작성">
      <h2 className={cx('heading')}>무엇이 궁금하세요?</h2>

      <div className={cx('field')}>
        <span className={cx('fieldLabel')} id="inquiry-category-label">
          어떤 내용인가요?
        </span>
        <div className={cx('chips')} role="radiogroup" aria-labelledby="inquiry-category-label">
          {CATEGORIES.map((value, index) => (
            <button
              key={value}
              ref={element => {
                chipRefs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={category === value}
              tabIndex={(category ?? CATEGORIES[0]) === value ? 0 : -1}
              className={cx('chip', { active: category === value })}
              onClick={() => selectCategory(value)}
              onKeyDown={event => handleChipKeyDown(event, index)}
            >
              {INQUIRY_CATEGORY_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      <label className={cx('field')}>
        <span className={cx('fieldHead')}>
          <span className={cx('fieldLabel')}>제목</span>
          <span className={cx('counter')} aria-hidden="true">
            {title.length}/{TITLE_MAX_LENGTH}
          </span>
        </span>
        <input
          className={cx('input')}
          value={title}
          onChange={event => {
            setTitle(event.target.value);
            setErrorMessage(null);
          }}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="예) 낙상 알림이 너무 자주 와요"
          autoFocus
        />
      </label>

      <label className={cx('field')}>
        <span className={cx('fieldHead')}>
          <span className={cx('fieldLabel')}>내용</span>
          <span className={cx('counter')} aria-hidden="true">
            {content.length}/{CONTENT_MAX_LENGTH}
          </span>
        </span>
        <textarea
          className={cx('textarea')}
          value={content}
          onChange={event => {
            setContent(event.target.value);
            setErrorMessage(null);
          }}
          maxLength={CONTENT_MAX_LENGTH}
          placeholder="언제, 어떤 일이 있었는지 적어 주시면 더 빨리 도와드릴 수 있어요"
          rows={5}
        />
      </label>

      {errorMessage && (
        <p className={cx('error')} role="alert">
          {errorMessage}
        </p>
      )}

      <div className={cx('actions')}>
        <button type="button" className={cx('cancel')} onClick={onCancel} disabled={isPending}>
          취소
        </button>
        <button type="submit" className={cx('submit')} disabled={!canSubmit}>
          {isPending ? '보내는 중...' : '보내기'}
        </button>
      </div>
    </form>
  );
}
