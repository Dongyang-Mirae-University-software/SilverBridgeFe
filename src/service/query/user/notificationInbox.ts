'use client';

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getMyNotifications, getMyUnreadNotificationCount } from '@/service/api/user/notificationInbox';

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

// 알림 창은 종류 하나(type, 서버 NotificationType 이름)로 거른다 - 생략 = 전체(2026-11-26, 이전엔 묶음 category 탭)
export const notificationInboxListQueryOptions = (type?: string) =>
  infiniteQueryOptions({
    queryKey: [...notificationInboxQueryKey, 'list', type ?? 'ALL'] as const,
    queryFn: ({ pageParam }) => getMyNotifications({ type, page: pageParam, size: NOTIFICATION_INBOX_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: lastPage => (lastPage && !lastPage.last ? lastPage.page + 1 : undefined),
    staleTime: 0,
    retry: false,
  });
