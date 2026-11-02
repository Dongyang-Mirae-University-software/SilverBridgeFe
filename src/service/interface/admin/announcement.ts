export interface AdminAnnouncementItem {
  id: number;
  authorId: string | null;
  authorName: string | null;
  title: string;
  content: string;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAnnouncementPage {
  content: AdminAnnouncementItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminAnnouncementSummary {
  publishedCount: number;
  draftCount: number;
}

export interface AdminAnnouncementListParams {
  page: number;
  size: number;
  keyword?: string;
}

export interface AdminAnnouncementWriteRequest {
  title: string;
  content: string;
}
