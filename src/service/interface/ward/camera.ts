// 피보호자(WARD)의 이상감지 카메라 등록 타입
// Swagger 그룹: "피보호자 - 카메라" (/api/ward/camera/**)

export interface WardCamera {
  id: number;
  sessionId: string;
  deviceId: string;
  label: string;
  isActive: boolean;
  recommendedFps: number;
  createdAt: string;
  // **송출** 방식(시청 방식 아님). ws-h264여도 지원·티켓·연결에 실패하면 같은 세션을 jpeg로 보낸다. 없으면 jpeg
  transport?: 'jpeg' | 'ws-h264';
}

// POST /api/ward/camera/{id}/upload-ticket - 송출 WebSocket 1회용 티켓(60초)
export interface WardCameraUploadTicket {
  ticket: string;
  expiresInSeconds: number;
  // 공개 wss 경로(쿼리 없음). `?ticket=`을 붙여 연결한다
  uploadUrl: string;
}

export interface RegisterWardCameraReq {
  label: string;
  deviceId?: string;
}

export interface UpdateWardCameraReq {
  label?: string;
  isActive?: boolean;
}

// 방은 서버가 내려주는 8개뿐 — FE에 목록을 따로 적어두지 않는다
export interface WardCameraRoom {
  label: string;
  registered: boolean;
}

// null은 "꺼짐"이 아니라 "지금 상태를 확인할 수 없음"(AI 서버 장애 등)
export type WardCameraConnectionStatus = 'running' | 'disconnected' | 'offline' | null;

export interface WardLiveCamera {
  id: number;
  sessionId: string;
  deviceId: string;
  label: string;
  status: WardCameraConnectionStatus;
  lastFrameAt: string | null;
  createdAt: string;
}
