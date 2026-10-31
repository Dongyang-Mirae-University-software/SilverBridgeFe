/**
 * 챗봇 "병원 예약하고 싶어요" 칩에서 고른 피보호자를 예약 화면으로 한 번만 넘긴다.
 * 주소창(?wardId=)에 싣지 않는다 - 피보호자 ID가 브라우저 기록·접속 로그에 남는다.
 * 피보호자 ID만 담고(이름·상담 문장 금지), 예약 화면이 읽는 즉시 지운다.
 */
export const RESERVATION_WARD_STORAGE_KEY = 'silverbridge_reservation_ward_id';

const MAX_ID_LENGTH = 64;

export function saveReservationWardId(wardId: string | null | undefined) {
  if (!wardId) return;
  try {
    window.sessionStorage.setItem(RESERVATION_WARD_STORAGE_KEY, wardId);
  } catch {
    // 저장소를 못 쓰면 넘기지 않는다 - 예약 화면은 첫 번째 피보호자로 시작한다.
  }
}

/** 담긴 값을 꺼내고 바로 지운다. 없거나 깨졌거나 저장소 예외면 null. */
export function takeReservationWardId(): string | null {
  try {
    const value = window.sessionStorage.getItem(RESERVATION_WARD_STORAGE_KEY);
    if (value !== null) window.sessionStorage.removeItem(RESERVATION_WARD_STORAGE_KEY);
    if (!value || value.length > MAX_ID_LENGTH || value.trim() !== value) return null;
    return value;
  } catch {
    return null;
  }
}
