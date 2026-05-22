import { queryOptions } from '@tanstack/react-query';

import { getAnnouncements, getAnnouncementDetail } from '../api/announcement';

export const announcementsQueryKey = ['announcements'] as const;

export const announcementsQueryOptions = queryOptions({
  queryKey: announcementsQueryKey,
  queryFn: getAnnouncements,
  staleTime: 5 * 60 * 1000,
});

export const announcementDetailQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ['announcement', id] as const,
    queryFn: () => getAnnouncementDetail(id),
    staleTime: 10 * 60 * 1000,
  });
