// 보호자(GUARDIAN)의 이상감지 이력 조회·오탐 응답 타입
// Swagger 그룹: "보호자 - 이상감지" (/api/guardian/anomaly/**)
// 단위는 "상황"(incident) — 같은 카메라의 10분 이내 연속 감지는 한 건으로 묶인다

export type AnomalyDetectedType = 'FIRE' | 'FALL' | 'WEAPON';
export type AnomalyReviewStatus = 'PENDING' | 'REAL' | 'FALSE_ALARM' | 'CONFLICTED';
export type AnomalyVerdict = 'REAL' | 'FALSE_ALARM';
export type AnomalyCameraFilter = 'DELETED' | 'EXISTING';

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
  type?: AnomalyDetectedType; // 생략 = 전체. 서버가 쿼리 안에서 거르므로 페이지·totalElements가 필터 기준이다
  camera?: AnomalyCameraFilter; // 생략 = 전체. 삭제된 카메라 = cameraLabel이 null인 이력과 같은 기준
  page?: number;
  size?: number;
}

// 이력 화면 건수 요약 - type 필터·페이지와 무관하게 조회 범위(ACTIVE 연결, wardId면 그 한 명) 전체를 센다
export interface AnomalyHistorySummary {
  total: number;
  pendingCount: number;
  conflictedCount: number;
  needsReviewCount: number; // 헤더 '확인 필요' = pendingCount + conflictedCount
  byType: { fire: number; fall: number; weapon: number };
  deletedCameraCount?: number; // 삭제된 카메라의 상황 수(= camera=DELETED의 totalElements). 구 서버면 없음
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
