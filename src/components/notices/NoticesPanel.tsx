'use client';

import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { announcementsQueryOptions } from '@/service/query/announcement';
import styles from './NoticesPanel.module.css';

const cx = classNames.bind(styles);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function NoticesPanel() {
  const { data: announcements = [], isLoading, isError, refetch } = useQuery(announcementsQueryOptions);

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
          {announcements.map((item, index) => (
            <li key={item.id} className={cx('item')}>
              <div className={cx('itemHeader')}>
                <div className={cx('itemLeft')}>
                  {index === 0 && <span className={cx('newBadge')}>NEW</span>}
                  <span className={cx('itemTitle')}>{item.title}</span>
                </div>
                <span className={cx('itemDate')}>
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                </span>
              </div>
              <div className={cx('itemBody')}>
                <div className={cx('itemMeta')}>
                  <span>{item.authorName}</span>
                  {item.updatedAt !== item.createdAt && (
                    <span className={cx('updatedTag')}>수정됨 ({formatDate(item.updatedAt)})</span>
                  )}
                </div>
                <p className={cx('itemContent')}>{item.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
