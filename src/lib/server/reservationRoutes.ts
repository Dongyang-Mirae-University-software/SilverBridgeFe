// 병원 예약 BFF가 예약 서비스로 넘기는 (메서드, 경로) 허용 목록. 화면이 실제로 부르는 것만 연다.
// 목록 밖(admin/*·users·auth/*·api-keys 등)은 BFF가 404로 끝내고 예약 서비스를 부르지 않는다.
export type ReservationRoute = {
  // 예약 서비스 기준 경로(앞 '/' 포함, /api/v1 뒤에 붙는다)
  path: string;
  // 허용한 쿼리만 다시 만든 문자열('' 또는 '?date=...')
  search: string;
  // 쓰기 요청 - 보호자가 피보호자 대신(x-sb-ward-id) 호출할 때만 허용
  write: boolean;
  // 요청 본문을 넘기는가(예약 만들기만 - 허용 필드만 다시 조립한다)
  body: boolean;
};

// 예약 서비스 id는 int32 - 10자리는 범위를 넘어 예약 서비스가 500을 낸다
const ID_PATTERN = /^[1-9][0-9]{0,8}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// 진료과 이름. 시간 칸은 진료과마다 따로라 빈 시간 조회에 함께 넘긴다.
// 관리자가 정하는 이름이라 글자 종류로 좁히지 않고 제어 문자·30자 초과만 막는다 - 값은 URLSearchParams 로 다시 인코딩해 넘긴다
const DEPARTMENT_PATTERN = /^[^\u0000-\u001f\u007f]{1,30}$/;

// 형식과 달력이 모두 맞는 날짜만(2026-02-30·2026-99-99는 거절)
export function isCalendarDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function matchReservationRoute(
  method: string,
  segments: string[],
  query: URLSearchParams,
): ReservationRoute | null {
  const m = method.toUpperCase();
  const [first, second, third, ...rest] = segments;
  if (rest.length > 0) return null;

  if (m === 'GET' && first === 'hospitals' && second === undefined) {
    return { path: '/hospitals', search: '', write: false, body: false };
  }
  if (m === 'GET' && first === 'hospitals' && ID_PATTERN.test(second ?? '') && third === 'available-slots') {
    const date = query.get('date') ?? '';
    if (!isCalendarDate(date)) return null;
    // 진료과는 선택 - 없으면 예약 서비스가 병원 전체 기준으로 센다(예전 동작)
    const department = query.get('department')?.trim() ?? '';
    if (department && !DEPARTMENT_PATTERN.test(department)) return null;
    const search = new URLSearchParams({ date, ...(department ? { department } : {}) }).toString();
    return { path: `/hospitals/${second}/available-slots`, search: `?${search}`, write: false, body: false };
  }
  if (m === 'GET' && first === 'reservations' && second === 'my' && third === undefined) {
    return { path: '/reservations/my', search: '', write: false, body: false };
  }
  if (m === 'POST' && first === 'reservations' && second === undefined) {
    return { path: '/reservations', search: '', write: true, body: true };
  }
  if (m === 'PATCH' && first === 'reservations' && ID_PATTERN.test(second ?? '') && third === 'cancel') {
    return { path: `/reservations/${second}/cancel`, search: '', write: true, body: false };
  }
  return null;
}
