'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { formatDate } from '@/lib/format/date';
import { announcementsQueryOptions } from '@/service/query/announcement';
import styles from './NoticesPage.module.css';

const cx = classNames.bind(styles);

function isNewNotice(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const diff = Date.now() - created.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

export function NoticesPage() {
  const { data: announcements = [], isLoading, isError, refetch } = useQuery(announcementsQueryOptions);
  const latestAnnouncement = [...announcements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  return (
    <section className={cx('page')}>
      <header className={cx('topBar')}>
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

      {latestAnnouncement && (
        <article className={cx('featured')}>
          <div className={cx('titleRow')}>
            <h2 className={cx('title')}>{latestAnnouncement.title}</h2>
            {isNewNotice(latestAnnouncement.createdAt) && <span className={cx('newBadge')}>NEW</span>}
          </div>
          <time className={cx('date')} dateTime={latestAnnouncement.createdAt}>
            {formatDate(latestAnnouncement.createdAt)}
          </time>
          <p className={cx('content')}>{latestAnnouncement.content}</p>
        </article>
      )}
    </section>
  );
}
