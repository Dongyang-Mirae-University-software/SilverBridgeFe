'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { IAnnouncement } from '@/service/interface/announcement';
import { announcementDetailQueryOptions, announcementsQueryOptions } from '@/service/query/announcement';
import styles from './NoticesPanel.module.css';

const cx = classNames.bind(styles);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function getList(response: unknown): IAnnouncement[] {
  const data = (response as { data?: unknown } | undefined)?.data;
  return Array.isArray(data) ? (data as IAnnouncement[]) : [];
}

function getDetail(response: unknown): IAnnouncement | null {
  const data = (response as { data?: unknown } | undefined)?.data;
  return data ? (data as IAnnouncement) : null;
}

export function NoticesPanel() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: listRes, isFetching, isLoading, isError, refetch } = useQuery(announcementsQueryOptions);
  const { data: detailRes } = useQuery({
    ...announcementDetailQueryOptions(selectedId!),
    enabled: selectedId !== null,
  });

  const announcements = getList(listRes);
  const detail = selectedId !== null ? (getDetail(detailRes) ?? announcements.find(a => a.id === selectedId) ?? null) : null;

  const handleToggle = (id: number) => {
    setSelectedId(prev => (prev === id ? null : id));
  };

  return (
    <section className={cx('page')}>
      <div className={cx('header')}>
        <div className={cx('headerTop')}>
          <span className={cx('eyebrow')}>공지사항</span>
          <button className={cx('refreshButton')} type="button" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? '새로고침 중' : '새로고침'}
          </button>
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
                    <p>{detail?.content ?? item.content}</p>
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
