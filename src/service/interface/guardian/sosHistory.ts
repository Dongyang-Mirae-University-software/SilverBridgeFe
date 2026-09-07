export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export type SosTriggerType = 'SOS_BUTTON' | 'GUARDIAN_CALL';

export interface IGuardianSosHistoryItem {
  sosEventId: number;
  wardId: string | null;
  wardName: string | null;
  triggeredAt: string;
  location: string | null;
  triggerType: SosTriggerType;
}
