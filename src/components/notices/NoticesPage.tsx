'use client';

import { useEffect, useState } from 'react';
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
  const [openNotice, setOpenNotice] = useState<IAnnouncement | null>(null);
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
        <NoticeCard key={announcement.id} announcement={announcement} ward={ward} onOpen={() => setOpenNotice(announcement)} />
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

      {openNotice && <NoticeDetailModal announcement={openNotice} onClose={() => setOpenNotice(null)} />}
    </section>
  );
}

// 목록 카드는 높이가 바뀌지 않게 본문 두 줄 미리보기만 두고, 누르면 상세 창으로 전체 본문을 연다
function NoticeCard({ announcement, ward, onOpen }: { announcement: IAnnouncement; ward: boolean; onOpen: () => void }) {
  const preview = isTruncatedPreview(announcement.content) ? `${announcement.content}…` : announcement.content;

  return (
    <article className={cx('card')}>
      <button className={cx('cardButton')} type="button" aria-haspopup="dialog" onClick={onOpen}>
        <span className={cx('metaRow')}>
          {isNewNotice(announcement.createdAt) && <span className={cx('newBadge')}>NEW</span>}
          <time className={cx('date')} dateTime={announcement.createdAt}>
            {formatDate(announcement.createdAt)}
          </time>
        </span>
        <span className={cx('title')} role="heading" aria-level={2}>
          {announcement.title}
        </span>
        <span className={cx('content', 'collapsed', { wardContent: ward })}>{preview}</span>
      </button>
    </article>
  );
}

function NoticeDetailModal({ announcement, onClose }: { announcement: IAnnouncement; onClose: () => void }) {
  // 상세는 부를 때마다 조회수가 오른다 - 창을 열 때만 부르고 10분 동안은 캐시를 쓴다
  const detail = useQuery(announcementDetailQueryOptions(announcement.id));
  const titleId = `notice-modal-title-${announcement.id}`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <header className={cx('modalHead')}>
          <div>
            <time className={cx('date')} dateTime={announcement.createdAt}>
              {formatDate(announcement.createdAt)}
            </time>
            <h2 className={cx('modalTitle')} id={titleId}>
              {announcement.title}
            </h2>
          </div>
          {/* 창을 열면 닫기에 초점을 둬 Esc·Enter로 바로 닫을 수 있게 한다 */}
          <button className={cx('closeButton')} type="button" aria-label="닫기" autoFocus onClick={onClose}>
            ✕
          </button>
        </header>
        <div className={cx('modalBody')}>
          {detail.isLoading && <p className={cx('detailState')}>내용을 불러오는 중…</p>}
          {detail.isError && <p className={cx('detailState', 'detailError')}>내용을 불러오지 못했습니다.</p>}
          {detail.data && <p className={cx('modalContent')}>{detail.data.content}</p>}
        </div>
      </section>
    </div>
  );
}
