/**
 * 화면에 보일 약 이름. BE가 내려 주는 짧은 이름(displayName - 끝쪽 용량·성분 괄호를 뗀 이름, BE #503)을 쓰고,
 * 옛 BE 응답처럼 없거나 비어 있으면 원래 이름(name)을 쓴다.
 *
 * 줄이는 규칙은 BE `MedicationDisplayName.of` 한 곳에만 둔다 - FE가 따로 줄이지 않는다(2026-11-20, FE 자체 축약 제거).
 * 용량만 다른 같은 약이 한 칸에 있어도 짧은 이름 그대로다(BE 사용자 결정). 원래 이름은 약 수정 창 입력값·title에 쓴다.
 */
export function medicationDisplayName(medication: { name: string; displayName?: string | null }): string {
  const display = medication.displayName?.trim();
  return display || medication.name.trim();
}
