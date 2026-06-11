'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { announcementsQueryOptions } from '@/service/query/announcement';
import styles from './NoticesPanel.module.css';

const cx = classNames.bind(styles);

type NoticeItem = {
  id: number;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function getLatestAnnouncementId(announcements: NoticeItem[]) {
  return announcements.reduce<NoticeItem | null>((latest, item) => {
    if (!latest) return item;
    return new Date(item.createdAt).getTime() > new Date(latest.createdAt).getTime() ? item : latest;
  }, null)?.id;
}

function getContentPreview(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) return normalized;
  return `${normalized.slice(0, 120).trimEnd()}…`;
}

export function NoticesPanel() {
  const { data: announcements = [], isLoading, isError, refetch } = useQuery(announcementsQueryOptions);
  const sortedAnnouncements = useMemo(
    () => [...announcements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [announcements],
  );
  const latestAnnouncement = sortedAnnouncements[0];
  const latestAnnouncementId = getLatestAnnouncementId(sortedAnnouncements);

  return (
    <section className={cx('page')}>
      <header className={cx('hero')}>
        <div className={cx('heroCopy')}>
          <p className={cx('eyebrow')}>공지사항</p>
          <h2>중요한 안내를 가장 먼저, 길게 읽지 않아도 되게 정리했습니다.</h2>
          <p className={cx('summaryText')}>최신 공지를 상단에서 바로 확인하고, 아래 목록은 제목과 핵심 내용만 빠르게 훑을 수 있습니다.</p>
        </div>
        <div className={cx('heroMeta')}>
          <div className={cx('metaCard')}>
            <span>전체 공지</span>
            <strong>{announcements.length}</strong>
          </div>
          <div className={cx('metaCard')}>
            <span>최신 공지</span>
            <strong>{latestAnnouncement ? formatDate(latestAnnouncement.createdAt) : '-'}</strong>
          </div>
          <RefreshButton ariaLabel="공지사항 새로고침" disabled={isLoading} onRefresh={() => refetch()} />
        </div>
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
        <div className={cx('content')}>
          {latestAnnouncement && (
            <article className={cx('featured')}>
              <div className={cx('featuredHeader')}>
                <div>
                  <p className={cx('sectionLabel')}>최신 공지</p>
                  <h3>{latestAnnouncement.title}</h3>
                </div>
                <span className={cx('latestBadge')}>NEW</span>
              </div>
              <p className={cx('featuredContent')}>{latestAnnouncement.content}</p>
              <div className={cx('featuredFooter')}>
                <span>{latestAnnouncement.authorName}</span>
                <time dateTime={latestAnnouncement.createdAt}>{formatDate(latestAnnouncement.createdAt)}</time>
              </div>
            </article>
          )}

          <ul className={cx('list')}>
            {sortedAnnouncements.map(item => (
              <li key={item.id} className={cx('item', { latest: item.id === latestAnnouncementId })}>
                <div className={cx('itemHeader')}>
                  <div className={cx('itemTopRow')}>
                    <span className={cx('itemTitle')}>{item.title}</span>
                    {item.id === latestAnnouncementId && <span className={cx('newBadge')}>NEW</span>}
                  </div>
                  <time className={cx('itemDate')} dateTime={item.createdAt}>
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                <p className={cx('itemContent')}>{getContentPreview(item.content)}</p>
                <div className={cx('itemFooter')}>
                  <span>{item.authorName}</span>
                  <span>공지 {item.id}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
