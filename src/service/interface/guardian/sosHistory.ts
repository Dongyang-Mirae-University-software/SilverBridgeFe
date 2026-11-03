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
  /** group=true 일 때만 내려온다. */
  pressCount?: number;
  firstTriggeredAt?: string;
  lastTriggeredAt?: string;
  /** 보호자에게 직접 전화한 SOS이며 현재도 연결된 경우에만 내려온다. */
  calledGuardianName?: string;
}

export interface ISosHistoryCounts {
  all: number;
  sosButton: number;
  guardianCall: number;
}

export interface IGuardianSosHistoryPage extends PageResponse<IGuardianSosHistoryItem> {
  counts: ISosHistoryCounts;
}
