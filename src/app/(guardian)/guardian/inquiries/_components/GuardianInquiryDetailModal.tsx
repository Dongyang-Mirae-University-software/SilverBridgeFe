'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { formatDateTime } from '@/utils/format/date';
import { guardianInquiryDetailQueryOptions } from '@/service/query/guardian/inquiry';
import { INQUIRY_CATEGORY_LABEL, INQUIRY_STATUS_LABEL } from './GuardianInquiryCard';
import { inquiryErrorMessage } from './inquiryErrorMessage';
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
        {isLoading && <p className={cx('status')}>불러오는 중이에요.</p>}
        {isError && (
          <>
            <p className={cx('status', 'error')} role="alert">
              {inquiryErrorMessage(error, '문의를 불러오지 못했어요.')}
            </p>
            <button type="button" className={cx('footerClose')} onClick={onClose}>
              닫기
            </button>
          </>
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
              <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="창 닫기">
                ✕
              </button>
            </header>

            <p className={cx('content')}>{inquiry.content}</p>

            {inquiry.status === 'ANSWERED' && inquiry.answer ? (
              <div className={cx('replyBox')}>
                <div className={cx('replyLabel')}>답변</div>
                <p className={cx('replyText')}>{inquiry.answer}</p>
                {inquiry.answeredAt && <span className={cx('replyDate')}>{formatDateTime(inquiry.answeredAt)}</span>}
              </div>
            ) : (
              <p className={cx('answerWaiting')}>아직 답변을 기다리고 있어요. 답변이 오면 알려 드릴게요.</p>
            )}

            <button type="button" className={cx('footerClose')} onClick={onClose}>
              닫기
            </button>
          </>
        )}
      </section>
    </div>
  );
}
