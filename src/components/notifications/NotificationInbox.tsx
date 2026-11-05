'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { getPushIconSrc, getPushRoute } from '@/components/PushNotificationListener.kind';
import { readAllMyNotifications, readMyNotification } from '@/service/api/user/notificationInbox';
import type {
  INotificationInboxItem,
  INotificationInboxPage,
  NotificationInboxCategory,
} from '@/service/interface/user/notificationInbox';
import {
  notificationInboxListQueryOptions,
  notificationInboxQueryKey,
  unreadNotificationCountQueryOptions,
} from '@/service/query/user/notificationInbox';
import { setSelectedWardId } from '@/store/selectedWardStore';
import { formatNotificationTime } from '@/utils/format/notificationTime';
import styles from './NotificationInbox.module.css';

const cx = classNames.bind(styles);

type InboxRole = 'GUARDIAN' | 'WARD';
type CategoryTab = 'ALL' | NotificationInboxCategory;

// 필터는 서버가 정한 category로만 나눈다 - 새 알림 종류가 생겨도 탭을 고칠 필요가 없다
const CATEGORY_TABS: Array<{ value: CategoryTab; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'URGENT', label: '긴급' },
  { value: 'MEDICATION', label: '복약' },
  { value: 'CONNECTION', label: '연결' },
  { value: 'OTHER', label: '그 밖' },
];

const listKey = [...notificationInboxQueryKey, 'list'] as const;
const unreadKey = unreadNotificationCountQueryOptions.queryKey;

// 읽음으로 바꾼 항목을 받아 둔 모든 탭 목록에 그 자리에서 반영한다
function markReadInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  isTarget: (item: INotificationInboxItem) => boolean,
) {
  queryClient.setQueriesData<InfiniteData<INotificationInboxPage | null>>({ queryKey: listKey }, data =>
    data
      ? {
          ...data,
          pages: data.pages.map(page =>
            page ? { ...page, content: page.content.map(item => (isTarget(item) ? { ...item, read: true } : item)) } : page,
          ),
        }
      : data,
  );
}

export function NotificationBellButton({ variant, open, onToggle }: { variant: 'guardian' | 'ward'; open: boolean; onToggle: () => void }) {
  const { data: count = 0 } = useQuery(unreadNotificationCountQueryOptions);

  return (
    <button
      className={cx('bellButton', variant)}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="notification-inbox"
      aria-label={count > 0 ? `알림, 안 읽은 알림 ${count}개` : '알림'}
      onClick={onToggle}
    >
      <Icon name="bell" size={variant === 'ward' ? 22 : 18} decorative />
      {/* 개수 대신 빨간 점만 - 개수는 화면 읽기 프로그램용 이름(aria-label)에만 둔다 */}
      {count > 0 && <span className={cx('badge')} aria-hidden="true" />}
    </button>
  );
}

export function NotificationPanel({ role, variant, onClose }: { role: InboxRole; variant: 'guardian' | 'ward'; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CategoryTab>('ALL');
  const panelRef = useRef<HTMLElement>(null);
  const { data: unread = 0 } = useQuery(unreadNotificationCountQueryOptions);
  const list = useInfiniteQuery(notificationInboxListQueryOptions(tab === 'ALL' ? undefined : tab));
  const items = list.data?.pages.flatMap(page => page?.content ?? []) ?? [];

  // 열면 창으로 초점을 옮기고, Esc·바깥 누름으로 닫는다
  useEffect(() => {
    panelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (panelRef.current?.contains(target) || target?.closest('[aria-controls="notification-inbox"]')) return;
      onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handlePointer);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handlePointer);
    };
  }, [onClose]);

  const readOne = useMutation({
    mutationFn: readMyNotification,
    onMutate: id => {
      markReadInCache(queryClient, item => item.id === id);
      queryClient.setQueryData<number>(unreadKey, current => Math.max(0, (current ?? 0) - 1));
    },
    // 없는 알림(404 - 90일 지남 등)이면 목록을 새로 받는다. 성공해도 서버 수와 맞춘다
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationInboxQueryKey }),
  });

  const readAll = useMutation({
    mutationFn: readAllMyNotifications,
    onSuccess: () => {
      markReadInCache(queryClient, () => true);
      queryClient.setQueryData<number>(unreadKey, 0);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationInboxQueryKey }),
  });

  const openItem = (item: INotificationInboxItem) => {
    if (!item.read) readOne.mutate(item.id);
    // 다른 피보호자에 관한 알림이면 그 피보호자를 골라 둔 채로 연다
    if (role === 'GUARDIAN' && item.wardId) setSelectedWardId(item.wardId);
    onClose();
    router.push(getPushRoute({ type: item.type }, role));
  };

  const emptyText = tab === 'ALL' ? '받은 알림이 없어요.' : `${CATEGORY_TABS.find(t => t.value === tab)?.label} 알림이 없어요.`;

  return (
    <section
      ref={panelRef}
      id="notification-inbox"
      className={cx('panel', variant)}
      role="dialog"
      aria-labelledby="notification-inbox-title"
      tabIndex={-1}
    >
      <header className={cx('head')}>
        <h2 id="notification-inbox-title">알림</h2>
        <button className={cx('readAll')} type="button" disabled={unread === 0 || readAll.isPending} onClick={() => readAll.mutate()}>
          모두 읽음
        </button>
        <button className={cx('close')} type="button" aria-label="알림 닫기" onClick={onClose}>
          <Icon name="close" size={18} decorative />
        </button>
      </header>

      <div className={cx('tabs')} role="tablist" aria-label="알림 종류">
        {CATEGORY_TABS.map(item => (
          <button
            key={item.value}
            className={cx('tab', { active: tab === item.value })}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={cx('body')}>
        {list.isLoading ? (
          <p className={cx('state')} role="status">알림을 불러오는 중이에요.</p>
        ) : list.isError && items.length === 0 ? (
          <div className={cx('state')} role="alert">
            <p>알림을 불러오지 못했어요.</p>
            <button className={cx('retry')} type="button" onClick={() => void list.refetch()}>다시 불러오기</button>
          </div>
        ) : items.length === 0 ? (
          <p className={cx('state')}>{emptyText}</p>
        ) : (
          <ul className={cx('list')}>
            {items.map(item => (
              <li key={item.id}>
                <button className={cx('item', { unread: !item.read })} type="button" onClick={() => openItem(item)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 푸시 토스트와 같은 정적 SVG 아이콘 */}
                  <img className={cx('icon')} src={getPushIconSrc({ type: item.type })} alt="" />
                  <span className={cx('text')}>
                    <span className={cx('titleRow')}>
                      <strong>{item.title || '알림'}</strong>
                      {!item.read && <span className={cx('srOnly')}>안 읽음</span>}
                    </span>
                    {item.body && <span className={cx('message')}>{item.body}</span>}
                    <time className={cx('meta')} dateTime={item.createdAt}>{formatNotificationTime(item.createdAt)}</time>
                  </span>
                  {!item.read && <span className={cx('dot')} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.hasNextPage && (
          <button className={cx('more')} type="button" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            {list.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </button>
        )}
      </div>
      <p className={cx('foot')}>최근 90일 동안 받은 알림만 보여요.</p>
    </section>
  );
}
