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
  options?: string[];
  label?: string;
  placeholder?: string;
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
  type?: 'tool_result' | 'ui' | null;
  tool?: ChatToolName;
  toolData?: unknown;
  ui?: ChatUiPromptData;
}

export interface ChatContext {
  age?: string;
  gender?: string;
  location?: string;
  name?: string;
  phone?: string;
}

export interface ChatRequest {
  message?: string;
  userId?: string;
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
  type?: 'tool_result' | 'ui' | null;
  tool?: ChatToolName;
  toolData?: unknown;
  ui?: ChatUiPromptData;
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
  createdAt?: string;
}

export const INTENT_LABEL: Record<string, string> = {
  emergency_guidance: '응급 안내',
  hospital_reservation: '병원 예약',
  medical_advice: '의료 상담',
};

export const RISK_LABEL: Record<ChatRiskLevel, string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

export const SAMPLE_CHIPS = ['응급 증상이 있어요', '병원 예약하고 싶어요', '건강 상담이 필요해요'];
