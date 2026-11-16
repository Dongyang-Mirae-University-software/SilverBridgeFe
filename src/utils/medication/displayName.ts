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

/**
 * 한 칸(같은 시간대)에 함께 보일 약 이름들. 줄인 이름이 서로 겹치면(용량만 다른 같은 약 - "아스피린 100mg"·"아스피린 500mg")
 * 그 약들은 원래 이름을 쓴다 - 어느 약을 먹었는지 헷갈리지 않게(2026-11-16 점검 L-1). 원래 이름까지 같으면 그대로 둔다.
 */
export function wardMedicationDisplayNames(names: readonly string[]): string[] {
  const short = names.map(wardMedicationDisplayName);
  const originalsByShort = new Map<string, Set<string>>();
  short.forEach((value, index) => {
    const originals = originalsByShort.get(value) ?? new Set<string>();
    originals.add(names[index].trim());
    originalsByShort.set(value, originals);
  });
  return short.map((value, index) => ((originalsByShort.get(value)?.size ?? 0) > 1 ? names[index].trim() : value));
}
