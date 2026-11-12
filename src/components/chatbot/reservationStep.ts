// 예약 진행 패널의 단계 표시(진료과·병원·날짜·시간). AI 응답에 단계 값이 따로 없어 지금 묻는 칸(ui.field)으로 정한다
// (2026-11-12 사용자 결정). 칸 이름은 AI 계약 코드다(reservationFlow 와 같은 값) - 문구로 추정하지 않는다.

export const RESERVATION_STEPS = ['진료과', '병원', '날짜', '시간'] as const;

const STEP_OF_FIELD: Record<string, number> = {
  department: 0,
  location_sido: 1,
  location: 1,
  location_confirm: 1,
  hospital: 1,
  hospital_confirm: 1,
  date: 2,
  time: 3,
  // 시간까지 고른 뒤(확인·수정·이름·전화)는 네 단계를 모두 마친 것으로 보인다
  reservation_confirm: RESERVATION_STEPS.length,
  reservation_edit: RESERVATION_STEPS.length,
  patient_name: RESERVATION_STEPS.length,
  phone: RESERVATION_STEPS.length,
};

/**
 * 지금 단계 번호(0부터). 모든 단계를 마쳤으면 RESERVATION_STEPS.length.
 * 새 예약 흐름이 아닌 칸(예약 조회·변경·취소, 대상 고르기 등)은 null - 단계 표시를 그리지 않는다.
 */
export function reservationStepIndex(field: string | undefined): number | null {
  if (!field) return null;
  return Object.prototype.hasOwnProperty.call(STEP_OF_FIELD, field) ? STEP_OF_FIELD[field] : null;
}
