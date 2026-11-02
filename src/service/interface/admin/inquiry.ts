export type AdminInquiryCategory = 'ANOMALY' | 'HOSPITAL' | 'ACCOUNT' | 'SERVICE' | 'ETC';
export type AdminInquiryStatus = 'WAITING' | 'ANSWERED';

export interface AdminInquiryListParams {
  category?: AdminInquiryCategory;
  status?: AdminInquiryStatus;
  keyword?: string;
  page: number;
  size: number;
}

export interface AdminInquiryListItem {
  id: number;
  category: AdminInquiryCategory;
  title: string;
  authorId: string;
  authorName: string;
  status: AdminInquiryStatus;
  createdAt: string;
}

export interface AdminInquiryPage {
  content: AdminInquiryListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminInquiryListResult {
  totalCount: number;
  waitingCount: number;
  answeredCount: number;
  inquiries: AdminInquiryPage;
}

export interface AdminInquiryDetail extends AdminInquiryListItem {
  content: string;
  answer: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
}
