// 관리자 대시보드에서 집계하는 이상 상황 유형. API는 0건 유형을 배열에 포함하지 않는다.
export type AdminDetectedType = 'FIRE' | 'FALL' | 'WEAPON';

export interface AdminSafetyDashboard {
  aiConnected: boolean;
  subscribedSessions: number;
  totalCameras: number;
  // AI 수신기 연결 또는 초기 세션 동기화 전에는 0이 아닌 null(확인 불가)이다.
  streamingCameras: number | null;
  safetyEvents: {
    disconnectedCameras: number | null;
    wardsWithoutGuardian: number;
    wardsWithoutReachableGuardian: number;
    wardsWithoutCamera: number;
    stalePendingConnections: number;
  };
  todayAnomaly: {
    total: number;
    byType: Array<{ detectedType: AdminDetectedType; count: number }>;
    review: {
      pending: number;
      real: number;
      falseAlarm: number;
      conflicted: number;
    };
  };
}

export interface AdminOperationDashboard {
  totalUsers: number;
  newUsersToday: number;
  memberComposition: { wards: number; guardians: number };
  cameras: { registered: number; wards: number };
  pendingConnections: number;
  unansweredInquiries: {
    count: number;
    // 미답변 문의가 없으면 0시간이 아니라 null(대기 문의 없음)이다.
    longestWaitingHours: number | null;
  };
  signupTrend: Array<{ date: string; count: number }>;
  pendingItems: {
    connectionRequests: number;
    todayInquiries: number;
    announcementDrafts: number;
  };
}
