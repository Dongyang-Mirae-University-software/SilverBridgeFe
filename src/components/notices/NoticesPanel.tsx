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
  const latestNotice = announcements[0] ?? null;

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
      <div className={cx('hero')}>
        <div className={cx('heroCopy')}>
          <span className={cx('eyebrow')}>공지사항</span>
          <h2>서비스 운영과 안내를 한눈에 확인하세요.</h2>
          <p>중요한 공지는 최신순으로 보여드리고, 선택한 공지는 오른쪽 상세 영역에서 바로 읽을 수 있습니다.</p>
        </div>
        <div className={cx('heroMeta')}>
          <div className={cx('heroStat')}>
            <span className={cx('heroStatLabel')}>전체 공지</span>
            <strong>{announcements.length.toLocaleString()}</strong>
          </div>
          <div className={cx('heroStat')}>
            <span className={cx('heroStatLabel')}>최신 공지</span>
            <strong>{latestNotice ? formatDate(latestNotice.createdAt) : '-'}</strong>
          </div>
          <RefreshButton ariaLabel="공지사항 새로고침" disabled={isLoading} onRefresh={() => refetch()} />
        </div>
      </div>

      {isLoading && <p className={cx('message')}>공지사항을 불러오는 중입니다.</p>}
      {isError && <p className={cx('message', 'error')}>공지사항을 불러오지 못했습니다.</p>}
      {!isLoading && !isError && announcements.length === 0 && (
        <p className={cx('message')}>등록된 공지사항이 없습니다.</p>
      )}

      {announcements.length > 0 && (
        <div className={cx('layout')}>
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
              </li>
            );
          })}
          </ul>

          <aside className={cx('detailPanel')}>
            {selectedNotice ? (
              <>
                <div className={cx('detailHeader')}>
                  <div className={cx('detailHeaderTop')}>
                    <span className={cx('detailEyebrow')}>선택한 공지</span>
                    <span className={cx('detailMeta')}>조회 {selectedNotice.viewCount.toLocaleString()}</span>
                  </div>
                  <h3>{selectedNotice.title}</h3>
                  <div className={cx('detailInfo')}>
                    <span>{selectedNotice.authorName}</span>
                    <span>{formatDate(selectedNotice.createdAt)}</span>
                  </div>
                </div>

                <div className={cx('detailBody')}>
                  <p>{selectedNotice.content}</p>
                </div>

                <div className={cx('detailFooter')}>
                  {selectedNotice.updatedAt !== selectedNotice.createdAt ? (
                    <span>수정일 {formatDate(selectedNotice.updatedAt)}</span>
                  ) : (
                    <span>최신 게시글입니다.</span>
                  )}
                </div>
              </>
            ) : (
              <div className={cx('detailEmpty')}>
                <span className={cx('detailEmptyEyebrow')}>미선택</span>
                <strong>공지 하나를 선택하면 상세 내용이 표시됩니다.</strong>
                <p>왼쪽 목록에서 항목을 누르면 여기에서 전체 내용을 읽을 수 있습니다.</p>
              </div>
            )}
          </aside>
        </div>
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
