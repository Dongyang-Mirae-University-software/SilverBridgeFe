export type WardSosTriggerType = 'SOS_BUTTON' | 'GUARDIAN_CALL';

export interface WardSosRequest {
  location?: string;
  triggerType?: WardSosTriggerType;
  /** GUARDIAN_CALL일 때 실제 전화를 건 ACTIVE 보호자의 사용자 ID */
  calledGuardianId?: string;
}

export interface WardSosResponse {
  sosEventId: number;
  triggeredAt: string;
}
