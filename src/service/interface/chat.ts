export type ChatRole = 'user' | 'assistant';
export type ChatRiskLevel = 'high' | 'medium' | 'low';
export type ChatUiKind = 'select' | 'date' | 'text';
export type ChatToolName =
  | 'search_hospital'
  | 'make_appointment'
  | 'list_my_appointments'
  | 'get_reservation';

export interface ChatUiPromptData {
  kind: ChatUiKind;
  field: string;
  options?: Array<string | ChatUiOption>;
  label?: string;
  placeholder?: string;
}

export interface ChatUiOption {
  value: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  engine?: string;
  modelName?: string;
  riskLevel?: ChatRiskLevel;
  intent?: string;
  type?: 'message' | 'tool_result' | 'ui' | null;
  tool?: ChatToolName;
  toolData?: unknown;
  ui?: ChatUiPromptData | null;
  // 구조화된 의학 응답 필드
  summary?: string;
  possibleCauses?: string[];
  homeCare?: string[];
  visitHospitalIf?: string[];
  emergencyWarning?: string[];
  recommendedAction?: string;
  reservationRequired?: boolean;
  /** 이 답에 이어서 물어볼 질문(0~3개, AI #135). 빠른 질문 칸을 대화 흐름대로 바꾼다. 되묻기 턴은 답 칩 4개. */
  suggestedQuestions?: string[];
  /** 칩 종류(AI 2026-11-02): "answer"면 되묻기에 눌러서 답하는 칩. 그 밖의 값·없음은 이어서 물어볼 질문. */
  suggestedKind?: string;  /** 답 모양(AI 2026-11-01). 없으면 content 로 그린다. */
  layout?: ChatLayout | null;
}

/**
 * 답 모양(AI 2026-11-01): 핵심 한 줄·본문(4줄 이내)·되묻기 질문·카드. 문장마다 줄 머리 이모지가 이미 붙어 온다.
 * 있으면 이것으로 그리고, 없으면(옛 AI·옛 기록·예약 흐름 답) 지금처럼 reply 로 그린다.
 * 문구·이모지를 비교해 판단하지 말 것 - 있는지만 본다.
 */
export interface ChatLayout {
  headline?: string | null;
  body?: string[];
  questions?: string[];
  homeCare?: string[];
  visitHospitalIf?: string[];
}

export interface ChatContext {
  age?: number;
  email?: string;
  name?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  postcode?: string;
  address?: string;
  addressDetail?: string;
  guardianId?: number;
  wardId?: string;
  wardName?: string;
  wardPhone?: string;
  patientId?: string;
  patientName?: string;
  patientBirthDate?: string;
  patientPhone?: string;
  patientGender?: string;
  relation?: string;
  location?: string;
  role?: string;
}

export function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export interface ChatRequest {
  message?: string;
  sessionId?: string;
  history?: Array<{ role: ChatRole; content: string }>;
  context?: ChatContext;
  uiSelection?: { field: string; value: string };
  reservation_followup?: string;
  reservation_id?: string;
}

export interface ChatResponse {
  reply: string;
  engine?: string;
  modelName?: string;
  riskLevel?: ChatRiskLevel;
  intent?: string;
  type?: 'message' | 'tool_result' | 'ui' | null;
  tool?: ChatToolName | null;
  toolData?: unknown;
  ui?: ChatUiPromptData | null;
  summary?: string;
  possibleCauses?: string[];
  homeCare?: string[];
  visitHospitalIf?: string[];
  emergencyWarning?: string[];
  recommendedAction?: string;
  reservationRequired?: boolean;
  /** 응급·자해·예약 선택지 답에는 빈 목록. 옛 AI는 칸이 없다. */
  suggestedQuestions?: string[];
  /** "answer"면 suggestedQuestions 는 되묻기 답 칩(AI 2026-11-02). 옛 AI·BE는 칸이 없다. */
  suggestedKind?: string;
  /** 답 모양(AI 2026-11-01). 옛 AI·예약 흐름 답은 null 또는 없음. */
  layout?: ChatLayout | null;
  chatLogId?: number;
  chatNo?: string;
  sessionId?: string;
}

export interface ChatLogItem {
  id?: string;
  sessionId?: string;
  userId?: string;
  message?: string;
  reply?: string;
  engine?: string;
  intent?: string;
  tool?: ChatToolName;
  riskLevel?: string;
  type?: string;
  toolData?: unknown;
  ui?: ChatUiPromptData;
  // 응급·위기 응답의 빨간 경고 박스 문구. 기록을 다시 열어도 119·109 안내가 보이게 BE가 내려준다(2026-10-24)
  emergencyWarning?: string[] | null;
  /** 답 모양(2026-11-01). 옛 기록은 null. */
  layout?: ChatLayout | null;
  createdAt?: string;
}

export const SAMPLE_CHIPS = ['응급 증상이 있어요', '병원 예약하고 싶어요', '건강 상담이 필요해요'];
