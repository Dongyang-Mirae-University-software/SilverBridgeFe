// 병원 예약 BFF가 예약 서비스로 넘기는 (메서드, 경로) 허용 목록. 화면이 실제로 부르는 것만 연다.
// 목록 밖(admin/*·users·auth/*·api-keys 등)은 BFF가 404로 끝내고 예약 서비스를 부르지 않는다.
export type ReservationRoute = {
  // 예약 서비스 기준 경로(앞 '/' 포함, /api/v1 뒤에 붙는다)
  path: string;
  // 허용한 쿼리만 다시 만든 문자열('' 또는 '?date=...')
  search: string;
  // 쓰기 요청 - 보호자가 피보호자 대신(x-sb-ward-id) 호출할 때만 허용
  write: boolean;
};

const ID_PATTERN = /^[1-9][0-9]{0,9}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function matchReservationRoute(
  method: string,
  segments: string[],
  query: URLSearchParams,
): ReservationRoute | null {
  const m = method.toUpperCase();
  const [first, second, third, ...rest] = segments;
  if (rest.length > 0) return null;

  if (m === 'GET' && first === 'hospitals' && second === undefined) {
    return { path: '/hospitals', search: '', write: false };
  }
  if (m === 'GET' && first === 'hospitals' && ID_PATTERN.test(second ?? '') && third === 'available-slots') {
    const date = query.get('date') ?? '';
    if (!DATE_PATTERN.test(date)) return null;
    return { path: `/hospitals/${second}/available-slots`, search: `?date=${date}`, write: false };
  }
  if (m === 'GET' && first === 'reservations' && second === 'my' && third === undefined) {
    return { path: '/reservations/my', search: '', write: false };
  }
  if (m === 'POST' && first === 'reservations' && second === undefined) {
    return { path: '/reservations', search: '', write: true };
  }
  if (m === 'PATCH' && first === 'reservations' && ID_PATTERN.test(second ?? '') && third === 'cancel') {
    return { path: `/reservations/${second}/cancel`, search: '', write: true };
  }
  return null;
}
