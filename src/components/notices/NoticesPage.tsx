'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { formatDate } from '@/utils/format/date';
import { announcementsQueryOptions } from '@/service/query/common/announcement';
import styles from './NoticesPage.module.css';

const cx = classNames.bind(styles);

function isNewNotice(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const diff = Date.now() - created.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

// fullWidthContent: 본문을 카드 폭만큼 쓴다(피보호자 화면). 기본은 읽기 좋은 폭(78ch)으로 줄인다.
export function NoticesPage({ fullWidthContent = false }: { fullWidthContent?: boolean }) {
  const { data: announcements = [], isLoading, isError, refetch } = useQuery(announcementsQueryOptions);
  const sortedAnnouncements = [...announcements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

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

      {!isLoading && !isError && sortedAnnouncements.length === 0 && (
        <div className={cx('empty')}>
          <span>등록된 공지사항이 없습니다.</span>
        </div>
      )}

      {sortedAnnouncements.map(announcement => (
        <article key={announcement.id} className={cx('card')}>
          <div className={cx('metaRow')}>
            {isNewNotice(announcement.createdAt) && <span className={cx('newBadge')}>NEW</span>}
            <time className={cx('date')} dateTime={announcement.createdAt}>
              {formatDate(announcement.createdAt)}
            </time>
          </div>
          <h2 className={cx('title')}>{announcement.title}</h2>
          <p className={cx('content', { fullWidthContent })}>{announcement.content}</p>
        </article>
      ))}
    </section>
  );
}
