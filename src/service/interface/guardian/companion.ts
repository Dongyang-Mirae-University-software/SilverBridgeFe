// 보호자(GUARDIAN)가 보는 피보호자 오늘 안부 대화(AI 말벗) 타입
// Swagger 그룹: "보호자 - AI 기분 체크" (/api/guardian/ward/{wardId}/companion/today)
// 어르신 대답 원문은 저장하지 않아 응답에 없다. null은 "모르는 값"이라 0·정상으로 채우지 않는다

export type CompanionMood = 'JOY' | 'CALM' | 'WORRY' | 'DEPRESSED';

export type CompanionSlotStatus = 'UPCOMING' | 'AVAILABLE' | 'IN_PROGRESS' | 'DONE' | 'MISSED';

export interface ICompanionSlot {
  slot: string; // "09:00"
  question: string | null;
  status: CompanionSlotStatus;
  mood: CompanionMood | null; // 마치지 않았거나 판단할 수 없으면 null
  sessionId?: number | null; // 그 시간대 대화 ID('대화 보기'용). 대화가 없으면 null
}

// 오늘 가장 최근에 마친 대화
export interface ICompanionCurrent {
  slot: string;
  mood: CompanionMood | null;
  endedAt: string;
  summary: string | null; // AI 미구현이라 지금은 항상 null
}

// 걱정·우울이 3일 이상 이어질 때만 온다
export interface ICompanionAttention {
  mood: Extract<CompanionMood, 'WORRY' | 'DEPRESSED'>;
  days: number;
}

export interface ICompanionToday {
  date: string;
  current: ICompanionCurrent | null;
  answeredCount: number;
  slotCount: number;
  nextSlot: string | null;
  slots: ICompanionSlot[];
  attention: ICompanionAttention | null;
}

// 최근 7일 하루 기분 - GET .../companion/week (오래된 날부터 오늘까지 7개)
export interface ICompanionDayMood {
  date: string; // "2026-11-11"
  mood: CompanionMood | null; // 판정된 대화가 없으면 null
}

export interface ICompanionWeek {
  days: ICompanionDayMood[];
}

// 대화 내용(글) 공개 상태 - 글은 AVAILABLE일 때만 온다
export type CompanionTranscriptState = 'AVAILABLE' | 'NO_CONSENT' | 'EXPIRED';

export interface ICompanionTurn {
  turnNo: number;
  mood: CompanionMood | null;
  botText: string | null; // 이 대답 뒤에 말벗이 한 말. 동의 없음·만료면 null
  answerText: string | null; // 어르신 대답. 동의 없음·만료면 null
}

// 대화 보기 - GET .../companion/sessions/{sessionId}
export interface ICompanionSessionDetail {
  sessionId: number;
  date: string;
  slot: string;
  question: string | null;
  status: 'OPEN' | 'FINISHED' | 'LOST';
  mood: CompanionMood | null;
  test: boolean;
  turnCount: number;
  negativeCount: number;
  riskAlerted: boolean;
  startedAt?: string | null;
  endedAt: string | null;
  turns: ICompanionTurn[];
  transcript: CompanionTranscriptState;
}
