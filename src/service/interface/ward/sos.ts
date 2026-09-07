export type WardSosTriggerType = 'SOS_BUTTON' | 'GUARDIAN_CALL';

export interface WardSosRequest {
  location?: string;
  triggerType?: WardSosTriggerType;
}

export interface WardSosResponse {
  sosEventId: number;
  triggeredAt: string;
}
