'use client';
import classNames from 'classnames/bind';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

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
      <div className={cx('header')}>
        <div className={cx('headerTop')}>
          <span className={cx('eyebrow')}>공지사항</span>
          <RefreshButton ariaLabel="공지사항 새로고침" disabled={isLoading} onRefresh={() => refetch()} />
        </div>
        <h2>서비스 운영 관련 공지를 확인하세요.</h2>
      </div>

      {isLoading && <p className={cx('message')}>공지사항을 불러오는 중입니다.</p>}
      {isError && <p className={cx('message', 'error')}>공지사항을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && announcements.length === 0 && (
        <p className={cx('message')}>등록된 공지사항이 없습니다.</p>
      )}

      {announcements.length > 0 && (
        <ul className={cx('list')}>
          {announcements.map(item => {
            const isOpen = selectedId === item.id;
            return (
              <li key={item.id} className={cx('item', { open: isOpen })}>
                <button className={cx('itemHeader')} type="button" aria-expanded={isOpen} onClick={() => handleToggle(item.id)}>
                  <div className={cx('itemInfo')}>
                    <strong className={cx('itemTitle')}>{item.title}</strong>
                    <div className={cx('itemMeta')}>
                      <span>{item.authorName}</span>
                      <span aria-label="조회수">조회 {item.viewCount.toLocaleString()}</span>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </div>
                  </div>
                  <span className={cx('chevron')} aria-hidden="true">
                    {isOpen ? '∧' : '∨'}
                  </span>
                </button>

                {isOpen && (
                  <div className={cx('itemBody')}>
                    <p>{selectedNotice?.content ?? item.content}</p>
                    {item.updatedAt !== item.createdAt && (
                      <span className={cx('updatedAt')}>수정일: {formatDate(item.updatedAt)}</span>
                    )}
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
  const now = Date.now();
  const lastUpdatedAt = record[id] ?? 0;
  const COOLDOWN_MS = 3000;

  return now - lastUpdatedAt >= COOLDOWN_MS;
}

function optimisticIncreaseViewCount(queryClient: QueryClient, id: number) {
  queryClient.setQueryData<IAnnouncement[]>(announcementsQueryKey, current =>
    current?.map(item => (item.id === id ? { ...item, viewCount: item.viewCount + 1 } : item)),
  );
  queryClient.setQueryData<IAnnouncement>(announcementDetailQueryKey(id), current =>
    current ? { ...current, viewCount: current.viewCount + 1 } : current,
  );
}
