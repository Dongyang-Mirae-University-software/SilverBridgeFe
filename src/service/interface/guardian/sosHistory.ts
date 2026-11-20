export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export type SosTriggerType = 'SOS_BUTTON' | 'GUARDIAN_CALL' | 'CHATBOT_119' | 'CHATBOT_109';

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
  chatbot119: number;
  /** 챗봇 109(자살예방 상담전화) 버튼 - BE #507(2026-11-20) 이전 서버는 내리지 않는다 */
  chatbot109?: number;
}

export interface IGuardianSosHistoryPage extends PageResponse<IGuardianSosHistoryItem> {
  counts: ISosHistoryCounts;
}
