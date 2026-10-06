'use client';

import { FormEvent, useState } from 'react';
import classNames from 'classnames/bind';

import { useCreateGuardianInquiryMutation } from '@/service/query/guardian/inquiry';
import { InquiryCategory } from '@/service/interface/guardian/inquiry';
import { showToast } from '@/store/toastStore';
import styles from './GuardianInquiryForm.module.css';

const cx = classNames.bind(styles);

const CATEGORY_OPTIONS: { value: InquiryCategory; label: string }[] = [
  { value: 'ANOMALY', label: '이상감지' },
  { value: 'HOSPITAL', label: '병원' },
  { value: 'ACCOUNT', label: '계정·회원' },
  { value: 'SERVICE', label: '서비스 이용' },
  { value: 'ETC', label: '기타' },
];

const TITLE_MAX_LENGTH = 100;
const CONTENT_MAX_LENGTH = 2000;

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

export function GuardianInquiryForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const createMutation = useCreateGuardianInquiryMutation();

  const canSubmit = Boolean(category) && title.trim().length > 0 && content.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!category || !canSubmit) return;

    createMutation.mutate(
      { category, title: title.trim(), content: content.trim() },
      {
        onSuccess: () => {
          setCategory(null);
          setTitle('');
          setContent('');
          showToast('문의가 접수되었습니다.', { variant: 'success' });
          onSubmitted?.();
        },
        onError: error => showToast(getErrorMessage(error, '문의를 보내지 못했습니다. 다시 시도해 주세요.'), { variant: 'error' }),
      },
    );
  };

  return (
    <form className={cx('form')} onSubmit={handleSubmit}>
      <div className={cx('field')}>
        <span className={cx('fieldLabel')}>분류</span>
        <div className={cx('chips')}>
          {CATEGORY_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={cx('chip', { active: category === option.value })}
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className={cx('field')}>
        <span className={cx('fieldLabel')}>제목</span>
        <input
          className={cx('input')}
          value={title}
          onChange={event => setTitle(event.target.value)}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="문의 제목을 입력하세요"
        />
      </label>

      <label className={cx('field')}>
        <span className={cx('fieldLabel')}>내용</span>
        <textarea
          className={cx('textarea')}
          value={content}
          onChange={event => setContent(event.target.value)}
          maxLength={CONTENT_MAX_LENGTH}
          placeholder="문의 내용을 자세히 적어주세요"
          rows={8}
        />
      </label>

      <button type="submit" className={cx('submit')} disabled={!canSubmit}>
        {createMutation.isPending ? '보내는 중...' : '문의 보내기'}
      </button>
    </form>
  );
}
