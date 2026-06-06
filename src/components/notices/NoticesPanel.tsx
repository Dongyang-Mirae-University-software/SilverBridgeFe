import clsx from 'clsx';
'use client';

import { useState } from 'react';
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


function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function NoticesPanel() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: announcements = [], isLoading, isError, refetch } = useQuery(announcementsQueryOptions);
  const { data: detail } = useQuery({
    ...announcementDetailQueryOptions(selectedId!),
    enabled: selectedId !== null,
  });

  const selectedNotice = selectedId !== null ? (detail ?? announcements.find(a => a.id === selectedId) ?? null) : null;

  const handleToggle = (id: number) => {
    setSelectedId(prev => {
      if (prev === id) return null;

      optimisticIncreaseViewCount(queryClient, id);
      return id;
    });
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.eyebrow}>공지사항</span>
          <RefreshButton ariaLabel="공지사항 새로고침" disabled={isLoading} onRefresh={() => refetch()} />
        </div>
        <h2>서비스 운영 관련 공지를 확인하세요.</h2>
      </div>

      {isLoading && <p className={styles.message}>공지사항을 불러오는 중입니다.</p>}
      {isError && <p className={clsx(styles.message, styles.error)}>공지사항을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && announcements.length === 0 && (
        <p className={styles.message}>등록된 공지사항이 없습니다.</p>
      )}

      {announcements.length > 0 && (
        <ul className={styles.list}>
          {announcements.map(item => {
            const isOpen = selectedId === item.id;
            return (
              <li key={item.id} className={clsx(styles.item, { [styles.open]: isOpen })}>
                <button className={styles.itemHeader} type="button" aria-expanded={isOpen} onClick={() => handleToggle(item.id)}>
                  <div className={styles.itemInfo}>
                    <strong className={styles.itemTitle}>{item.title}</strong>
                    <div className={styles.itemMeta}>
                      <span>{item.authorName}</span>
                      <span aria-label="조회수">조회 {item.viewCount.toLocaleString()}</span>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </div>
                  </div>
                  <span className={styles.chevron} aria-hidden="true">
                    {isOpen ? '∧' : '∨'}
                  </span>
                </button>

                {isOpen && (
                  <div className={styles.itemBody}>
                    <p>{selectedNotice?.content ?? item.content}</p>
                    {item.updatedAt !== item.createdAt && (
                      <span className={styles.updatedAt}>수정일: {formatDate(item.updatedAt)}</span>
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

function optimisticIncreaseViewCount(queryClient: QueryClient, id: number) {
  queryClient.setQueryData<IAnnouncement[]>(announcementsQueryKey, current =>
    current?.map(item => (item.id === id ? { ...item, viewCount: item.viewCount + 1 } : item)),
  );
  queryClient.setQueryData<IAnnouncement>(announcementDetailQueryKey(id), current =>
    current ? { ...current, viewCount: current.viewCount + 1 } : current,
  );
}
