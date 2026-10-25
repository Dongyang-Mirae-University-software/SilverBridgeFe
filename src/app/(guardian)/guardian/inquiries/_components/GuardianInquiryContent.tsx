'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import PageLayout from '@/components/layout/PageLayout';
import { guardianInquiriesQueryOptions } from '@/service/query/guardian/inquiry';
import { GuardianInquiryForm } from './GuardianInquiryForm';
import { GuardianInquiryCard } from './GuardianInquiryCard';
import { GuardianInquiryDetailModal } from './GuardianInquiryDetailModal';
import styles from './GuardianInquiryContent.module.css';

const cx = classNames.bind(styles);

const PAGE_SIZE = 20;
const SENT_NOTICE_MS = 5000;

export function GuardianInquiryContent() {
  const [writing, setWriting] = useState(false);
  const [sent, setSent] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: inquiries = [], isLoading, isError } = useQuery(
    guardianInquiriesQueryOptions({ page, size: PAGE_SIZE }),
  );
  const isLastPage = inquiries.length < PAGE_SIZE;

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(false), SENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [sent]);

  const writeButton = !writing && (
    <button
      type="button"
      className={cx('writeButton')}
      onClick={() => {
        setWriting(true);
        setSent(false);
      }}
    >
      <Icon name="plus" size={16} />
      문의 남기기
    </button>
  );

  return (
    <PageLayout title="문의하기" actions={writeButton}>
      <section className={cx('page')}>
        {sent && (
          <p className={cx('sentNotice')} role="status">
            문의를 남겼어요. 답변이 오면 알려 드릴게요.
          </p>
        )}

        {writing && (
          <GuardianInquiryForm
            onCancel={() => setWriting(false)}
            onSubmitted={() => {
              setWriting(false);
              setSent(true);
              setPage(0);
            }}
          />
        )}

        {isLoading && <p className={cx('emptyText')}>문의 내역을 불러오는 중이에요.</p>}
        {isError && <p className={cx('emptyText')}>문의 내역을 불러오지 못했어요.</p>}
        {!isLoading && !isError && inquiries.length === 0 && (
          // 목록에 전체 건수가 없어 정확히 20건이면 "다음"이 보인다 - 넘긴 뒤 빈 페이지는 끝이라는 뜻
          <p className={cx('emptyText')}>{page > 0 ? '더 이상 문의가 없어요' : '아직 남긴 문의가 없어요'}</p>
        )}

        {inquiries.length > 0 && (
          <ul className={cx('list')} aria-label="내 문의 내역">
            {inquiries.map(inquiry => (
              <GuardianInquiryCard key={inquiry.id} inquiry={inquiry} onClick={() => setSelectedId(inquiry.id)} />
            ))}
          </ul>
        )}

        {(page > 0 || !isLastPage) && (
          <div className={cx('pagination')}>
            <button type="button" disabled={page === 0} onClick={() => setPage(current => Math.max(current - 1, 0))}>
              이전
            </button>
            <span>{page + 1}</span>
            <button type="button" disabled={isLastPage} onClick={() => setPage(current => current + 1)}>
              다음
            </button>
          </div>
        )}

        {selectedId != null && (
          <GuardianInquiryDetailModal inquiryId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </section>
    </PageLayout>
  );
}
