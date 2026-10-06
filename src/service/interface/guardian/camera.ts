// 보호자(GUARDIAN)의 카메라 실시간 시청 — 영상·분석 모두 백엔드가 중계한다.
// AI 서버 키는 백엔드 안에만 있고, 브라우저는 백엔드만 호출한다.
// Swagger 그룹: "보호자 - 카메라" (/api/guardian/camera)

// null은 "꺼짐"이 아니라 "지금 상태를 확인할 수 없음"(AI 서버 장애 등)을 뜻한다
export type GuardianCameraLiveStatus = 'running' | 'disconnected' | 'offline' | null;

export interface GuardianLiveCamera {
  sessionId: string;
  wardId: string;
  wardName: string;
  label: string;
  status: GuardianCameraLiveStatus;
  lastFrameAt: string | null;
}

export interface GuardianCameraAnalysis {
  detectedType: string;
  detectedTypeLabel: string;
  confidence: number;
  danger: boolean;
  analyzedAt: string;
}

export interface GuardianCameraStatus {
  status: GuardianCameraLiveStatus;
  lastFrameAt: string | null;
  fps: number | null;
  isAnalyzing: boolean;
  analysis: GuardianCameraAnalysis | null;
}

export interface GuardianCameraStreamTicket {
  ticket: string;
  expiresInSeconds: number;
}

export interface GuardianCameraFileError {
  status: number;
  code?: string;
  message?: string;
}

export type DetectState = 'fire' | 'smoke' | 'knife' | 'fall' | 'person' | 'danger' | 'safe';

/** @deprecated 백엔드 중계(`/live`)로 대체됨 — useGuardianMonitor 재작성 후 삭제 예정 */
export interface GuardianCameraAllowlistItem {
  sessionId: string;
  wardId: string;
  wardName: string;
  label: string;
  isActive: boolean;
}
