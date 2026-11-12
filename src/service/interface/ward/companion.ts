// 피보호자(WARD) 안부 말벗 - 하루 5번(09·12·15·18·21시) 각 시작 시각부터 60분 동안 여는 짧은 안부 대화
// Swagger 그룹: "피보호자 - 안부 말벗" (/api/ward/companion/**)
// 대답 글·음성·사진·말벗 응답 문장은 서버가 저장하지 않는다 - 화면도 메모리에만 둔다(localStorage·로그 금지)

import type { CompanionMood, CompanionSlotStatus } from '../guardian/companion';

export type CompanionEndReason = 'MAX_TURNS' | 'NO_RESPONSE' | 'USER_STOP';

export interface IWardCompanionSlot {
  slot: string; // "09:00"
  status: CompanionSlotStatus;
  mood: CompanionMood | null; // 어르신 화면에는 보이지 않는다(보호자 화면용)
}

export interface IWardCompanionToday {
  date: string;
  currentSlot: string | null; // 지금 열 수 있는 시간대. 없으면 대화 시작 버튼을 숨긴다
  slots: IWardCompanionSlot[];
  testMode?: boolean; // 최종 QA 테스트 계정이면 true - 시간대를 골라 시작·테스트 안내 푸시를 쓸 수 있다
}

export interface IWardCompanionSession {
  sessionId: number;
  slot: string;
  question: string; // 첫 질문 - 크게 보여 주고 읽어 준다
  maxTurns: number | null; // null이면 표시하지 않는다
  resumed: boolean; // 열려 있던 대화를 이어 가면 true
}

export interface IWardCompanionReply {
  turnNo: number;
  reply: string | null; // 말벗 응답 문장
  ended: boolean; // true면 서버가 결과를 이미 저장했다 - 마치기를 따로 부르지 않는다
  endReason: CompanionEndReason | null;
  transcript: string | null; // 음성 대답을 받아 적은 글(음성 턴만)
  analysis?: IWardCompanionTurnAnalysis; // 테스트 계정에만 실린다(일반 계정은 필드 없음)
}

// 테스트 계정 확인용 턴 판정 - AI 값 그대로. 화면 메모리에만 두고 저장하지 않는다
export interface IWardCompanionTurnAnalysis {
  turnLabel: string | null; // 기쁨·평온·슬픔·우울·판단 보류 등(AI 턴 라벨, WORRY는 슬픔), 무응답이면 null
  turnSource: string | null; // TEXT·FACE·NO_RESPONSE 등
  face?: {
    usable?: boolean;
    label?: string | null;
    confidence?: number | null;
    frameCount?: number | null;
    totalFrames?: number | null;
    facesFound?: number | null;
  } | null;
  riskFlag: boolean;
  signals?: Record<string, unknown> | null;
  // 말(글) 기분 분류 - AI textMood 그대로. 무응답·되묻기 턴이나 AI가 주지 않으면 null
  textMood?: {
    label?: string | null; // 모델 원래 라벨
    turnLabel?: string | null; // 턴 라벨로 바꾼 값(기쁨·평온·슬픔·우울 등)
    confidence?: number | null; // 0~1
    usable?: boolean;
    reason?: string | null; // SHORT(최소 글자 수 미만)·UNAVAILABLE(모델 없음·시간 초과)
  } | null;
}

export interface IWardCompanionFinish {
  sessionId: number;
  slot: string;
  endReason: CompanionEndReason;
  mood: CompanionMood | null;
  turnCount: number;
  analysis?: IWardCompanionResultAnalysis; // 테스트 계정에만 실린다
}

export interface IWardCompanionResultAnalysis {
  mood: CompanionMood | null;
  turnCount: number;
  answeredCount?: number | null;
  noResponseCount?: number | null;
  riskFlag: boolean;
  alertLevel?: string | null; // URGENT·INFO, 없으면 null
  test?: boolean;
}

// 대화 내용(글) 가족 공유 동의 - GET/PUT /api/ward/companion/transcript-consent
// 동의하면 보호자가 '대화 보기'에서 글을 본다(보관 retentionDays일 뒤 지움). 철회하면 저장된 글을 바로 지운다
export interface IWardCompanionTranscriptConsent {
  consented: boolean;
  consentedAt: string | null; // 처음 동의한 시각. 동의한 적이 없으면 null
  retentionDays: number;
  notice: string[]; // 동의 받을 때 그대로 보여 줄 고지 항목(순서대로)
}
