export type AdminNotificationCategory = 'SOS' | 'ANOMALY' | 'MEDICATION' | 'OTHER';
export type AdminNotificationResult = 'DELIVERED' | 'SMS_FALLBACK' | 'FAILED' | 'NOT_SENT';
export type AdminNotificationPeriod = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

export interface AdminNotificationChannelResult {
  channel: string;
  status: string;
  reason: string | null;
  reasonLabel: string | null;
}

// 알림 한 건은 이벤트가 아니라 수신자 한 명 기준이다. 같은 SOS를 가족 둘이 받으면 두 행이 온다.
export interface AdminNotificationLogItem {
  id: number;
  sentAt: string;
  type: string;
  typeLabel: string;
  category: AdminNotificationCategory;
  wardId: string | null;
  wardName: string | null;
  title: string;
  body: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  recipientIsWard: boolean;
  relation: string | null;
  deliveredChannels: string[];
  result: AdminNotificationResult;
  notSentReason: string | null;
  notSentReasonLabel: string | null;
  channelResults: AdminNotificationChannelResult[];
}

export interface AdminNotificationPage {
  content: AdminNotificationLogItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminNotificationSummary {
  period: AdminNotificationPeriod;
  total: number;
  delivered: number;
  smsFallback: number;
  failed: number;
  notSent: number;
}

export interface AdminNotificationListParams {
  category?: AdminNotificationCategory;
  result?: AdminNotificationResult;
  period: AdminNotificationPeriod;
  keyword?: string;
  page: number;
  size: number;
}

export interface AdminNotificationSummaryParams {
  category?: AdminNotificationCategory;
  period: AdminNotificationPeriod;
  keyword?: string;
}
