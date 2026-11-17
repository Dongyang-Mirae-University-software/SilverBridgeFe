import type { ChatLayout, ChatMessage } from '@/service/interface/chat';

/** AI 응급·위기 표시 칸 - 불리언 true 만 인정한다(문자열 "true"·숫자 1 은 무시). */
function isUrgentLayout(layout: ChatLayout | null | undefined): boolean {
  return !!layout && typeof layout === 'object' && !Array.isArray(layout) && layout.urgent === true;
}

/** 경고 문장 - 문자열만 남긴다(빈 칸·이상한 값은 없는 것으로 본다). */
export function emergencyWarnings(message: Pick<ChatMessage, 'emergencyWarning'>): string[] {
  const value: unknown = message.emergencyWarning;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * 응급·위기 답인가. 경고가 있거나, 위험도 high(자해 고정 응답은 경고 없이 high 만 온다),
 * 또는 AI layout.urgent === true(위기 뒤 해제 턴은 경고·high 가 없다 - 2026-11-09 점검 M-1).
 * 문구·이모지(🚨)는 보지 않고 칸이 있는지만 본다. 말풍선 긴급 상자와 피보호자 119 패널이 같은 판정을 쓴다.
 */
export function isUrgentAnswer(message: Pick<ChatMessage, 'emergencyWarning' | 'riskLevel' | 'layout'>): boolean {
  return emergencyWarnings(message).length > 0 || message.riskLevel === 'high' || isUrgentLayout(message.layout);
}

/**
 * 자해·위기 답인가(의료 응급이 아닌 쪽). 응급 판정이면서 경고 문장이 없는 경우다 -
 * 자해 고정 응답은 riskLevel high 만, 위기 뒤 이어지는 턴은 layout.urgent 만 오고 경고는 없다.
 * AI 가 위기 구분 메타를 FE 에 보내지 않아 칸 구조로 따져 보는 대용이다(문구·이모지 비교 금지).
 * 잘못 가려져도 109 안내 한 줄이 켜지고 꺼질 뿐이다.
 */
export function isCrisisAnswer(message: Pick<ChatMessage, 'emergencyWarning' | 'riskLevel' | 'layout'>): boolean {
  return isUrgentAnswer(message) && emergencyWarnings(message).length === 0;
}
