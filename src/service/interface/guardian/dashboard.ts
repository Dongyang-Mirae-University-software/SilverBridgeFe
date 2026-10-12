// 보호자(GUARDIAN) 대시보드 요약 타입
// Swagger 그룹: "보호자 - 대시보드" (/api/guardian/dashboard)
// 각 섹션이 null이면 조회 실패(unavailable)라는 뜻이고, 연결된 피보호자가 0명인 경우와는 다르다

import { AnomalyIncident } from './anomaly';
import { IGuardianSosHistoryItem } from './sosHistory';
import { MedicationTimeSlot } from '../medication';

export interface GuardianDashboardWardSummary {
  wardId: string;
  wardName: string | null;
  pendingCount: number | null;
}

export interface GuardianDashboardPendingActions {
  total: number | null;
  anomaly: number | null;
  medication: number | null;
}

export interface GuardianDashboardAnomalySection {
  needsReviewCount: number | null;
  latest: AnomalyIncident | null;
}

export interface GuardianDashboardSosSection {
  thisMonthCount: number | null;
  latest: IGuardianSosHistoryItem | null;
}

export interface GuardianDashboardMedicationMostUrgent {
  wardId: string;
  wardName: string | null;
  medicationId: number;
  name: string;
  timeSlot: MedicationTimeSlot;
  doseTime: string;
}

export interface GuardianDashboardMedicationSection {
  uncheckedCount: number | null;
  mostUrgent: GuardianDashboardMedicationMostUrgent | null;
}

export type GuardianDashboardUnavailableSection = 'anomalyDetection' | 'sos' | 'medication';

export interface GuardianDashboardResponse {
  pendingActions: GuardianDashboardPendingActions;
  wards: GuardianDashboardWardSummary[];
  anomalyDetection: GuardianDashboardAnomalySection;
  sos: GuardianDashboardSosSection;
  medication: GuardianDashboardMedicationSection;
  unavailable: GuardianDashboardUnavailableSection[];
}

export interface GetGuardianDashboardParams {
  wardId?: string;
}
