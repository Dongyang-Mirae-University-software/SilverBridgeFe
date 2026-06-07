'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import {
  announcementDetailQueryKey,
  announcementDetailQueryOptions,
  announcementsQueryKey,
  announcementsQueryOptions,
} from '@/service/query/announcement';
import { IAnnouncement } from '@/service/interface/announcement';
import styles from './NoticesPanel.module.css';

const cx = classNames.bind(styles);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function NoticesPanel() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const optimisticViewCountAtRef = useRef<Record<number, number>>({});

  const { data: announcements = [], isLoading, isError, refetch } = useQuery(announcementsQueryOptions);
  const { data: detail } = useQuery({
    ...announcementDetailQueryOptions(selectedId!),
    enabled: selectedId !== null,
  });

  const selectedNotice = selectedId !== null ? (detail ?? announcements.find(a => a.id === selectedId) ?? null) : null;

  const handleToggle = (id: number) => {
    setSelectedId(prev => {
      const next = prev === id ? null : id;

      if (next !== null && shouldOptimisticallyIncreaseViewCount(optimisticViewCountAtRef.current, next)) {
        optimisticIncreaseViewCount(queryClient, next);
        optimisticViewCountAtRef.current[next] = Date.now();
      }

      return next;
    });
  };

  useEffect(() => {
    if (selectedId === null || !detail) return;
    syncNoticeViewCount(queryClient, selectedId, detail);
  }, [detail, queryClient, selectedId]);

  return (
    <section className={cx('page')}>
      <header className={cx('header')}>
        <RefreshButton ariaLabel="공지사항 새로고침" disabled={isLoading} onRefresh={() => refetch()} />
      </header>

      {isLoading && (
        <div className={cx('empty')}>
          <span>불러오는 중…</span>
        </div>
      )}

      {isError && (
        <div className={cx('empty', 'emptyError')}>
          <span>공지사항을 불러오지 못했습니다.</span>
        </div>
      )}

      {!isLoading && !isError && announcements.length === 0 && (
        <div className={cx('empty')}>
          <span>등록된 공지사항이 없습니다.</span>
        </div>
      )}

      {announcements.length > 0 && (
        <ul className={cx('list')}>
          {announcements.map((item, index) => {
            const isOpen = selectedId === item.id;
            const isNew = index === 0;

            return (
              <li key={item.id} className={cx('item', { open: isOpen })}>
                <button
                  className={cx('itemButton')}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => handleToggle(item.id)}
                >
                  <div className={cx('itemLeft')}>
                    {isNew && <span className={cx('newBadge')}>NEW</span>}
                    <span className={cx('itemTitle')}>{item.title}</span>
                  </div>
                  <div className={cx('itemRight')}>
                    <span className={cx('itemDate')}>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </span>
                    <svg
                      className={cx('chevron', { open: isOpen })}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {isOpen && selectedNotice && (
                  <div className={cx('itemBody')}>
                    <div className={cx('itemMeta')}>
                      <span>{selectedNotice.authorName}</span>
                      <span>{formatDate(selectedNotice.createdAt)}</span>
                      <span>조회 {selectedNotice.viewCount.toLocaleString()}</span>
                      {selectedNotice.updatedAt !== selectedNotice.createdAt && (
                        <span className={cx('updatedTag')}>수정됨 ({formatDate(selectedNotice.updatedAt)})</span>
                      )}
                    </div>
                    <p className={cx('itemContent')}>{selectedNotice.content}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function syncNoticeViewCount(queryClient: QueryClient, id: number, notice: IAnnouncement) {
  queryClient.setQueryData<IAnnouncement[]>(announcementsQueryKey, current =>
    current?.map(item => (item.id === id ? { ...item, viewCount: notice.viewCount } : item)),
  );
  queryClient.setQueryData<IAnnouncement>(announcementDetailQueryKey(id), current =>
    current ? { ...current, viewCount: notice.viewCount } : notice,
  );
}

function shouldOptimisticallyIncreaseViewCount(record: Record<number, number>, id: number) {
  const lastUpdatedAt = record[id] ?? 0;
  return Date.now() - lastUpdatedAt >= 3000;
}

function optimisticIncreaseViewCount(queryClient: QueryClient, id: number) {
  queryClient.setQueryData<IAnnouncement[]>(announcementsQueryKey, current =>
    current?.map(item => (item.id === id ? { ...item, viewCount: item.viewCount + 1 } : item)),
  );
  queryClient.setQueryData<IAnnouncement>(announcementDetailQueryKey(id), current =>
    current ? { ...current, viewCount: current.viewCount + 1 } : current,
  );
}
