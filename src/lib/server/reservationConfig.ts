// 병원 예약 서비스 BFF 설정. 기본값을 두지 않는다 - 코드에 비밀값·공개 주소를 두면 저장소를 보는 누구나
// 예약 계정 비밀번호(HMAC)를 계산하거나 공개 도메인으로 직접 붙을 수 있다. 비어 있으면 예약 기능만 끈다.
export type ReservationConfig = { apiBase: string; accountSecret: string };

export function readReservationConfig(env: Record<string, string | undefined> = process.env): ReservationConfig | null {
  const accountSecret = env.RESERVATION_ACCOUNT_SECRET?.trim();
  const url = env.RESERVATION_API_URL?.trim();
  if (!accountSecret || !url) return null;
  return { apiBase: `${url.replace(/\/$/, '')}/api/v1`, accountSecret };
}
