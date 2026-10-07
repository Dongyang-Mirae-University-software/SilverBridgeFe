'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { guardianInquiriesQueryOptions } from '@/service/query/guardian/inquiry';
import { GuardianInquiryForm } from './GuardianInquiryForm';
import { GuardianInquiryCard } from './GuardianInquiryCard';
import { GuardianInquiryDetailModal } from './GuardianInquiryDetailModal';
import styles from './GuardianInquiryContent.module.css';

const cx = classNames.bind(styles);

const PAGE_SIZE = 20;
type Tab = 'write' | 'history';

const TABS: { value: Tab; label: string }[] = [
  { value: 'history', label: '내 문의 내역' },
  { value: 'write', label: '새 문의 작성' },
];

export function GuardianInquiryContent() {
  const [tab, setTab] = useState<Tab>('history');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: inquiries = [], isLoading, isError } = useQuery(
    guardianInquiriesQueryOptions({ page, size: PAGE_SIZE }),
  );
  const isLastPage = inquiries.length < PAGE_SIZE;

  return (
    <section className={cx('page')}>
      <div className={cx('tabRow')} role="tablist" aria-label="문의 메뉴">
        {TABS.map(item => (
          <button
            key={item.value}
            className={cx('tabButton', { tabButtonActive: tab === item.value })}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'write' ? (
        <GuardianInquiryForm
          onSubmitted={() => {
            setPage(0);
            setTab('history');
          }}
        />
      ) : (
        <>
          {isLoading && <p className={cx('emptyText')}>문의 내역을 불러오는 중입니다.</p>}
          {isError && <p className={cx('emptyText')}>문의 내역을 불러오지 못했습니다.</p>}
          {!isLoading && !isError && inquiries.length === 0 && (
            <p className={cx('emptyText')}>아직 작성한 문의가 없습니다.</p>
          )}

          {inquiries.length > 0 && (
            <ul className={cx('list')}>
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
        </>
      )}

      {selectedId != null && (
        <GuardianInquiryDetailModal inquiryId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </section>
  );
}
