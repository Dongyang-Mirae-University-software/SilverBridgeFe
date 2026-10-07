// 보호자(GUARDIAN)의 이상감지 이력 조회·오탐 응답 타입
// Swagger 그룹: "보호자 - 이상감지" (/api/guardian/anomaly/**)
// 단위는 "상황"(incident) — 같은 카메라의 10분 이내 연속 감지는 한 건으로 묶인다

export type AnomalyDetectedType = 'FIRE' | 'FALL' | 'WEAPON';
export type AnomalyReviewStatus = 'PENDING' | 'REAL' | 'FALSE_ALARM' | 'CONFLICTED';
export type AnomalyVerdict = 'REAL' | 'FALSE_ALARM';

export interface AnomalyClip {
  clipId: number;
  incidentId: number;
  detectedAt: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  createdAt: string;
}

export interface AnomalyIncident {
  incidentId: number;
  wardId: string;
  wardName: string;
  cameraLabel: string | null; // 카메라가 삭제되면 null (이력은 남음)
  detectedType: AnomalyDetectedType;
  detectedTypeLabel: string;
  startedAt: string;
  lastDetectedAt: string;
  eventCount: number;
  maxConfidence: number;
  reviewStatus: AnomalyReviewStatus;
  myVerdict: AnomalyVerdict | null; // 내가 아직 응답하지 않았으면 null
  clip: AnomalyClip | null; // 볼 수 있는 클립 중 최신 1개 (없으면 null)
  clipCount: number; // 볼 수 있는 클립 수
}

export interface AnomalyClipFileError {
  status: number;
  code?: string;
  message?: string;
}

export interface AnomalyHistoryPage {
  content: AnomalyIncident[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface GetAnomalyHistoryParams {
  wardId?: string;
  page?: number;
  size?: number;
}

export interface AnomalyFeedbackReq {
  verdict: AnomalyVerdict;
}

export interface AnomalyFeedbackRes {
  incidentId: number;
  reviewStatus: AnomalyReviewStatus;
  myVerdict: AnomalyVerdict;
}

export interface AnomalyReminderSetting {
  reviewReminderEnabled: boolean;
}

export interface UpdateAnomalyReminderSettingReq {
  reviewReminderEnabled?: boolean;
}
