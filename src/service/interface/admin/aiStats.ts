export interface AdminChatStatsParams {
  from: string;
  to: string;
}

// 값이 없으면 null 이다(BE Long). 0 으로 바꿔 보이지 말 것 - 화면은 "정보 없음"으로 보인다
export interface AdminChatRouterFailuresByKind {
  credit: number | null; // 크레딧 부족
  auth: number | null; // 키 인증 실패
  timeout: number | null; // 시간 초과
  other: number | null; // 그 밖
}

export type AdminChatRouterState = 'ok' | 'failing' | 'credit_exhausted' | 'off';

export interface AdminChatRouterStatus {
  state: AdminChatRouterState;
  recentFailures: number; // 최근 창 안 실패 수
  windowSec: number; // 실패를 세는 창 길이(초)
}

export interface AdminChatStats {
  from: string;
  to: string;
  totalChats: number | null;
  users: number | null;
  byRole: {
    guardian: number | null;
    ward: number | null;
    unknown: number | null;
  };
  byRoute: {
    reservation: number | null;
    symptom: number | null;
    general: number | null;
    unknown: number | null;
  };
  emergencyGuidance: number | null;
  reservationCompleted: number | null;
  fallbackReplies: number | null;
  // 라우터(분류 모델) 칸 - 선택 칸이라 옛 BE·AI면 없고(undefined), 형식이 어긋나면 null. 둘 다 "정보 없음"
  routerFailures?: number | null; // 기간 안 라우터 실패로 키워드 경로를 탄 상담 수(2026-11-09 이전 기간은 0)
  routerFailuresByKind?: AdminChatRouterFailuresByKind | null;
  routerStatus?: AdminChatRouterStatus | null; // 조회 기간과 무관한 지금 상태
  daily: Array<{
    date: string;
    totalChats: number | null;
  }>;
  generatedAt: string;
}

// GET /api/admin/ai-stats/companion - 오늘(KST) 안부 말벗 집계. 대화 원문·요약은 없다
// null은 모르는 값이라 0으로 채우지 않는다(보낸 질문이 없으면 responseRate null)
export interface AdminCompanionMoodDistribution {
  wardCount: number; // 오늘 마친 대화가 있는 어르신 수
  joy: number;
  calm: number;
  worry: number;
  depressed: number;
  unknown: number; // 판단할 수 없음 - 막대에 넣지 않는다
}

export interface AdminCompanionContinuingWard {
  wardId: string;
  name: string | null; // 탈퇴 등으로 못 찾으면 null
  mood: 'WORRY' | 'DEPRESSED';
  days: number;
}

export interface AdminCompanionNoDialogueWard {
  wardId: string;
  name: string | null;
  lastDialogueAt: string | null; // 한 번도 대답한 적 없으면 null
}

export interface AdminCompanionStats {
  date: string;
  askedCount: number;
  responseRate: number | null; // 정수 %
  noDialogueWardCount: number;
  alertSentCount: number;
  moodDistribution: AdminCompanionMoodDistribution;
  continuingWards: AdminCompanionContinuingWard[]; // 며칠째 많은 순
  noDialogueWards: AdminCompanionNoDialogueWard[]; // 오래전에 대답한 어르신부터
  generatedAt: string;
}
