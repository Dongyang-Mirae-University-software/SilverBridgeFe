'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { formatDateTime } from '@/utils/format/date';
import { guardianInquiryDetailQueryOptions } from '@/service/query/guardian/inquiry';
import { INQUIRY_CATEGORY_LABEL, INQUIRY_STATUS_LABEL } from './GuardianInquiryCard';
import styles from './GuardianInquiryDetailModal.module.css';

const cx = classNames.bind(styles);

export function GuardianInquiryDetailModal({ inquiryId, onClose }: { inquiryId: number; onClose: () => void }) {
  const { data: inquiry, isLoading, isError, error } = useQuery(guardianInquiryDetailQueryOptions(inquiryId));

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="문의 상세"
        onClick={event => event.stopPropagation()}
      >
        {isLoading && <p className={cx('status')}>불러오는 중입니다.</p>}
        {isError && (
          <p className={cx('status', 'error')} role="alert">
            {(error as { message?: string })?.message ?? '문의를 불러오지 못했습니다.'}
          </p>
        )}

        {inquiry && (
          <>
            <header className={cx('header')}>
              <div>
                <div className={cx('meta')}>
                  <span className={cx('categoryBadge')}>{INQUIRY_CATEGORY_LABEL[inquiry.category]}</span>
                  <span className={cx('statusBadge', inquiry.status.toLowerCase())}>
                    {INQUIRY_STATUS_LABEL[inquiry.status]}
                  </span>
                </div>
                <h3 className={cx('title')}>{inquiry.title}</h3>
                <span className={cx('date')}>{formatDateTime(inquiry.createdAt)}</span>
              </div>
              <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </header>

            <p className={cx('content')}>{inquiry.content}</p>

            {inquiry.status === 'ANSWERED' && inquiry.answer ? (
              <div className={cx('replyBox')}>
                <div className={cx('replyLabel')}>관리자 답변</div>
                {inquiry.answer}
              </div>
            ) : (
              <p className={cx('answerWaiting')}>아직 답변이 등록되지 않았습니다.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
