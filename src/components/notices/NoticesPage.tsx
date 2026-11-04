'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { RefreshButton } from '@/components/RefreshButton';
import { formatDate } from '@/utils/format/date';
import {
  announcementDetailQueryOptions,
  announcementsQueryKey,
  announcementsQueryOptions,
} from '@/service/query/common/announcement';
import { IAnnouncement } from '@/service/interface/common/announcement';
import styles from './NoticesPage.module.css';

const cx = classNames.bind(styles);

// 목록 content는 서버가 앞 100자(코드포인트, 이모지 1개 = 1자)로 자른 미리보기다. 말줄임표는 붙어 오지 않는다
const PREVIEW_LENGTH = 100;

function isNewNotice(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const diff = Date.now() - created.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function isTruncatedPreview(content: string) {
  return Array.from(content).length >= PREVIEW_LENGTH;
}

// variant="ward"(피보호자 화면): 본문이 카드 폭을 다 쓰고, 새로고침 줄이 첫 카드 위에 빈 칸을 만들지 않는다.
// 기본(보호자 화면)은 읽기 좋은 폭(78ch)으로 줄인다.
export function NoticesPage({ variant = 'default' }: { variant?: 'default' | 'ward' }) {
  const ward = variant === 'ward';
  const queryClient = useQueryClient();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(announcementsQueryOptions);
  // 서버가 최신순으로 준다 - 페이지를 이어 붙이기만 한다
  const announcements = data?.pages.flat() ?? [];

  return (
    <section className={cx('page')}>
      <header className={cx('topBar', { wardTopBar: ward })}>
        <RefreshButton
          ariaLabel="공지사항 새로고침"
          disabled={isLoading}
          // 더 보기로 받은 페이지까지 다시 받지 않고 첫 페이지부터 다시 받는다
          onRefresh={() => queryClient.resetQueries({ queryKey: announcementsQueryKey, exact: true })}
        />
      </header>

      {isLoading && (
        <div className={cx('empty')}>
          <span>불러오는 중…</span>
        </div>
      )}

      {isError && announcements.length === 0 && (
        <div className={cx('empty', 'emptyError')}>
          <span>공지사항을 불러오지 못했습니다.</span>
        </div>
      )}

      {!isLoading && !isError && announcements.length === 0 && (
        <div className={cx('empty')}>
          <span>등록된 공지사항이 없습니다.</span>
        </div>
      )}

      {announcements.map(announcement => (
        <NoticeCard key={announcement.id} announcement={announcement} ward={ward} />
      ))}

      {hasNextPage && (
        <button
          className={cx('moreButton')}
          type="button"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </section>
  );
}

function NoticeCard({ announcement, ward }: { announcement: IAnnouncement; ward: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = isTruncatedPreview(announcement.content);
  // 상세는 부를 때마다 조회수가 오른다 - 잘린 공지를 펼칠 때만 부른다
  const detail = useQuery({ ...announcementDetailQueryOptions(announcement.id), enabled: truncated && expanded });
  const bodyId = `notice-body-${announcement.id}`;

  let body = truncated ? `${announcement.content}…` : announcement.content;
  if (expanded && detail.data) body = detail.data.content;

  return (
    <article className={cx('card')}>
      <div className={cx('metaRow')}>
        {isNewNotice(announcement.createdAt) && <span className={cx('newBadge')}>NEW</span>}
        <time className={cx('date')} dateTime={announcement.createdAt}>
          {formatDate(announcement.createdAt)}
        </time>
      </div>
      <h2 className={cx('title')}>{announcement.title}</h2>
      <p className={cx('content', { wardContent: ward })} id={bodyId}>
        {body}
      </p>
      {expanded && detail.isLoading && <p className={cx('detailState')}>전체 내용을 불러오는 중…</p>}
      {expanded && detail.isError && <p className={cx('detailState', 'detailError')}>전체 내용을 불러오지 못했습니다.</p>}
      {truncated && (
        <button
          className={cx('expandButton')}
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? '접기' : '전체 보기'}
          <span className={cx('chevron', { open: expanded })} aria-hidden="true">
            ▼
          </span>
        </button>
      )}
    </article>
  );
}
