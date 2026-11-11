/** 이 글자 수를 넘는 이름만 끝의 용량 표기를 뺀다(2026-11-11 사용자 결정 - 태블릿 2열 칸에서 줄바꿈 방지). */
export const WARD_MED_NAME_MAX = 8;

// 이름 끝의 용량 표기: 숫자(소수) + 단위, "5/50mg" 같은 복합 용량, "500mg/5mL" 같은 농도, 괄호로 감싼 것까지. 대소문자 무시.
const UNIT = '(?:mcg|µg|μg|mg|g|ml|l|iu|%|밀리그램|밀리리터)';
const TRAILING_DOSE = new RegExp(
  `[\\s(\\[]*\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+(?:[.,]\\d+)?)*\\s*${UNIT}(?:\\s*\\/\\s*(?:\\d+(?:[.,]\\d+)?\\s*)?${UNIT})?\\s*[)\\]]?\\s*$`,
  'i',
);

/**
 * 피보호자 복약 칸에 보일 약 이름. 길면 끝의 용량 표기를 뺀다 - 보호자 화면·약 상세는 원래 이름을 쓴다.
 * 빼고 나서 이름이 비면 원래 이름을 그대로 쓴다.
 */
export function wardMedicationDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= WARD_MED_NAME_MAX) return trimmed;
  const stripped = trimmed.replace(TRAILING_DOSE, '').trim();
  return stripped || trimmed;
}
