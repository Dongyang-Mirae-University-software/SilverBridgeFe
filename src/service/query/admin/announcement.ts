import { queryOptions } from '@tanstack/react-query';

import * as api from '@/service/api/admin/announcement';
import { AdminAnnouncementListParams } from '@/service/interface/admin/announcement';

export const adminAnnouncementQueryKey = ['admin-announcement'] as const;

export const adminAnnouncementListQueryOptions = (params: AdminAnnouncementListParams, draft = false) => queryOptions({
  queryKey: [...adminAnnouncementQueryKey, draft ? 'drafts' : 'published', params] as const,
  queryFn: () => draft ? api.getAdminAnnouncementDrafts(params) : api.getAdminAnnouncements(params),
  staleTime: 15_000,
});

export const adminAnnouncementSummaryQueryOptions = queryOptions({ queryKey: [...adminAnnouncementQueryKey, 'summary'] as const, queryFn: api.getAdminAnnouncementSummary, staleTime: 15_000 });
export const adminAnnouncementDetailQueryOptions = (id: number | null, draft: boolean) => queryOptions({ queryKey: [...adminAnnouncementQueryKey, draft ? 'draft-detail' : 'detail', id] as const, queryFn: () => draft ? api.getAdminAnnouncementDraft(id as number) : api.getAdminAnnouncement(id as number), enabled: id !== null });
