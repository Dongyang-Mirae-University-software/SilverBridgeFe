import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getAnnouncementDetail, getAnnouncements } from '@/service/api/common/announcement';

export const announcementsQueryKey = ['announcements'] as const;
export const announcementDetailQueryKey = (id: number) => ['announcement', id] as const;

export const ANNOUNCEMENT_PAGE_SIZE = 20;

// 응답에 전체 개수가 없다 - 받은 개수가 size보다 적으면 마지막 페이지다
export const announcementsQueryOptions = infiniteQueryOptions({
  queryKey: announcementsQueryKey,
  queryFn: ({ pageParam }) => getAnnouncements({ page: pageParam, size: ANNOUNCEMENT_PAGE_SIZE }),
  initialPageParam: 0,
  getNextPageParam: (lastPage, _pages, lastPageParam) =>
    lastPage.length < ANNOUNCEMENT_PAGE_SIZE ? undefined : lastPageParam + 1,
  staleTime: 5 * 60 * 1000,
});

// 상세는 부를 때마다 조회수가 오른다 - 창을 열 때마다 다시 불러 조회수를 올린다(2026-11-26 사용자 결정, 전에는 10분 캐시).
// 창을 닫으면 캐시를 바로 버려(gcTime 0) 다시 열 때 이전 값이 잠깐 보이지 않게 한다.
export const announcementDetailQueryOptions = (id: number) =>
  queryOptions({
    queryKey: announcementDetailQueryKey(id),
    queryFn: () => getAnnouncementDetail(id),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
