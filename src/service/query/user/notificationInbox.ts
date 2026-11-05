'use client';

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getMyNotifications, getMyUnreadNotificationCount } from '@/service/api/user/notificationInbox';
import type { NotificationInboxCategory } from '@/service/interface/user/notificationInbox';

export const notificationInboxQueryKey = ['notification-inbox'] as const;
export const NOTIFICATION_INBOX_PAGE_SIZE = 20;

// 실시간 이벤트가 없다 - 창 포커스(TanStack 기본)·화면 이동·포그라운드 푸시 때 다시 받는다
export const unreadNotificationCountQueryOptions = queryOptions({
  queryKey: [...notificationInboxQueryKey, 'unread-count'] as const,
  queryFn: getMyUnreadNotificationCount,
  staleTime: 0,
  refetchOnWindowFocus: 'always',
  retry: false,
});

export const notificationInboxListQueryOptions = (category?: NotificationInboxCategory) =>
  infiniteQueryOptions({
    queryKey: [...notificationInboxQueryKey, 'list', category ?? 'ALL'] as const,
    queryFn: ({ pageParam }) => getMyNotifications({ category, page: pageParam, size: NOTIFICATION_INBOX_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: lastPage => (lastPage && !lastPage.last ? lastPage.page + 1 : undefined),
    staleTime: 0,
    retry: false,
  });
