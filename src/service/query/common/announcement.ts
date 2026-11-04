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

// 상세는 부를 때마다 조회수가 오른다 - 펼칠 때 한 번만 부르고 10분 동안 다시 부르지 않는다
export const announcementDetailQueryOptions = (id: number) =>
  queryOptions({
    queryKey: announcementDetailQueryKey(id),
    queryFn: () => getAnnouncementDetail(id),
    staleTime: 10 * 60 * 1000,
    // 접어서 쓰는 곳이 없어져도 10분 안에 다시 펼치면 캐시를 쓴다(기본 gcTime 5분)
    gcTime: 10 * 60 * 1000,
  });
