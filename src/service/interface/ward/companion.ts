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
}

export interface IWardCompanionFinish {
  sessionId: number;
  slot: string;
  endReason: CompanionEndReason;
  mood: CompanionMood | null;
  turnCount: number;
}
