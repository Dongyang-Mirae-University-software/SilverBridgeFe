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
 * 응급·위기 답인가. 경고가 있거나, 위험도 high(자해 고정 응답은 경고와 high 가 함께 온다 - AI 2026-10-24 부터),
 * 또는 AI layout.urgent === true(위기 뒤 해제 턴은 경고·high 가 없다 - 2026-11-09 점검 M-1).
 * 문구·이모지(🚨)는 보지 않고 칸이 있는지만 본다. 말풍선 긴급 상자와 피보호자 119 패널이 같은 판정을 쓴다.
 */
export function isUrgentAnswer(message: Pick<ChatMessage, 'emergencyWarning' | 'riskLevel' | 'layout'>): boolean {
  return emergencyWarnings(message).length > 0 || message.riskLevel === 'high' || isUrgentLayout(message.layout);
}

/**
 * 자해·위기 답인가(의료 응급이 아닌 쪽) - AI layout.crisis === true 만 본다(AI #317, 2026-11-17).
 * 자해 고정 응답에도 경고 문장이 있어 경고 유무로는 의료 응급과 가를 수 없었다(FE #277 점검 H-1).
 * 문구·이모지는 보지 않는다. 칸이 없는 옛 답·옛 기록은 위기로 보지 않는다(109 안내 한 줄만 빠진다).
 */
export function isCrisisAnswer(message: Pick<ChatMessage, 'emergencyWarning' | 'riskLevel' | 'layout'>): boolean {
  const layout = message.layout;
  return (
    isUrgentAnswer(message) &&
    !!layout &&
    typeof layout === 'object' &&
    !Array.isArray(layout) &&
    layout.crisis === true
  );
}
