// 병원 예약 BFF - 허용 목록 밖은 404(예약 서비스 미호출), 보호자 대리는 ACTIVE 연결만, 502는 고정 문구
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as route from './route';

const { GET, PATCH, POST } = route;

const SB = 'https://sb.test';
const RES = 'https://reservation.test';

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let reservationResponse: () => Response | Promise<Response>;
let wards: { partnerUserId: string; partnerName: string; partnerPhone: string | null }[];
let profileId: string;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  calls.push({ url, init });
  if (url === `${SB}/api/user/me`) return Promise.resolve(json({ data: { id: profileId, name: '보호자' } }));
  if (url.startsWith(`${SB}/api/guardian/connection/select`)) return Promise.resolve(json({ data: wards }));
  if (url === `${RES}/api/v1/auth/login`) return Promise.resolve(json({ accessToken: 'res-token' }));
  if (url.startsWith(RES)) return Promise.resolve(reservationResponse());
  return Promise.reject(new Error(`unexpected ${url}`));
}

function request(method: string, path: string[], options: { search?: string; ward?: string; body?: string } = {}) {
  const headers: Record<string, string> = { authorization: 'Bearer sb-token' };
  if (options.ward) headers['x-sb-ward-id'] = options.ward;
  const req = new NextRequest(`http://fe.test/api/reservation/${path.join('/')}${options.search ?? ''}`, {
    method,
    headers,
    body: options.body,
  });
  return [req, { params: Promise.resolve({ path }) }] as const;
}

const reservationCalls = () => calls.filter(call => call.url.startsWith(`${RES}/api/v1/`) && !call.url.includes('/auth/'));

function setUp() {
  calls = [];
  // 토큰 캐시가 사용자 ID 기준이라 테스트마다 새 ID를 써서 서로 영향을 주지 않게 한다
  profileId = `u${Math.random().toString(36).slice(2, 8)}`;
  wards = [{ partnerUserId: 'ward01', partnerName: '김영희', partnerPhone: '010-1234-5678' }];
  reservationResponse = () => json([]);
  vi.stubEnv('RESERVATION_ACCOUNT_SECRET', 'test-secret');
  vi.stubEnv('RESERVATION_API_URL', RES);
  vi.stubEnv('NEXT_PUBLIC_API_DOMAIN', SB);
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}

function tearDown() {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

describe('reservation BFF route', () => {
  beforeEach(setUp);
  afterEach(tearDown);

  it.each([
    ['GET', ['hospitals'], '', undefined, '/hospitals'],
    ['GET', ['hospitals', '3', 'available-slots'], '?date=2026-10-24', undefined, '/hospitals/3/available-slots?date=2026-10-24'],
    ['GET', ['reservations', 'my'], '', undefined, '/reservations/my'],
    ['GET', ['reservations', 'my'], '', 'ward01', '/reservations/my'],
    ['POST', ['reservations'], '', 'ward01', '/reservations'],
    ['PATCH', ['reservations', '12', 'cancel'], '', 'ward01', '/reservations/12/cancel'],
  ])('허용 경로 %s %j는 예약 서비스로 넘긴다', async (method, path, search, ward, target) => {
    const [req, ctx] = request(method, path, { search, ward, body: method === 'POST' ? '{"a":1}' : undefined });
    const handler = { GET, POST, PATCH }[method as 'GET' | 'POST' | 'PATCH'];
    const res = await handler(req, ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [] });
    const [call] = reservationCalls();
    expect(call.url).toBe(`${RES}/api/v1${target}`);
    expect(call.init?.method).toBe(method);
    expect((call.init?.headers as Record<string, string>).authorization).toBe('Bearer res-token');
  });

  it('허용한 쿼리(date)만 넘긴다', async () => {
    const [req, ctx] = request('GET', ['hospitals', '3', 'available-slots'], { search: '?date=2026-10-24&x=1' });
    await GET(req, ctx);
    expect(reservationCalls()[0].url).toBe(`${RES}/api/v1/hospitals/3/available-slots?date=2026-10-24`);
  });

  it.each([
    ['GET', ['admin', 'reservations']],
    ['GET', ['admin']],
    ['GET', ['users']],
    ['GET', ['users', 'me']],
    ['POST', ['auth', 'api-keys']],
    ['GET', ['auth', 'api-keys']],
    ['POST', ['auth', 'login']],
    ['GET', ['hospitals', '3']],
    ['GET', ['hospitals', '3', 'departments']],
    ['GET', ['reservations', '12']],
    ['GET', ['hospitals', 'abc', 'available-slots']],
    ['GET', ['hospitals', '..', 'available-slots']],
    ['GET', ['hospitals', '-1', 'available-slots']],
    ['PATCH', ['reservations', '1e3', 'cancel']],
    ['PATCH', ['reservations', 'my', 'cancel']],
    ['GET', ['reservations', 'my', 'extra']],
    ['POST', ['hospitals']],
    ['GET', ['reservations']],
  ])('허용 목록 밖 %s %j는 404이고 예약 서비스·로그인 확인을 부르지 않는다', async (method, path) => {
    const [req, ctx] = request(method, path, { ward: 'ward01', search: '?date=2026-10-24' });
    const handler = { GET, POST, PATCH }[method as 'GET' | 'POST' | 'PATCH'];
    const res = await handler(req, ctx);

    expect(res.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('날짜 형식이 틀린 빈 시간 조회는 404', async () => {
    const [req, ctx] = request('GET', ['hospitals', '3', 'available-slots'], { search: '?date=tomorrow' });
    expect((await GET(req, ctx)).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('DELETE 메서드는 열지 않는다', () => {
    expect('DELETE' in route).toBe(false);
  });

  it('wardId 헤더가 ACTIVE 연결이 아니면 403이고 예약 서비스를 부르지 않는다', async () => {
    const [req, ctx] = request('GET', ['reservations', 'my'], { ward: 'other99' });
    const res = await GET(req, ctx);

    expect(res.status).toBe(403);
    expect(reservationCalls()).toEqual([]);
    expect(calls.some(call => call.url.includes('/auth/'))).toBe(false);
    expect(calls.find(call => call.url.includes('/connection/select'))?.url).toContain('status=ACTIVE');
  });

  it('wardId 헤더 없는 쓰기(예약·취소)는 403', async () => {
    const [post, postCtx] = request('POST', ['reservations'], { body: '{}' });
    const [patch, patchCtx] = request('PATCH', ['reservations', '12', 'cancel']);

    expect((await POST(post, postCtx)).status).toBe(403);
    expect((await PATCH(patch, patchCtx)).status).toBe(403);
    expect(reservationCalls()).toEqual([]);
  });

  it('로그인 토큰이 없으면 401', async () => {
    const req = new NextRequest('http://fe.test/api/reservation/reservations/my');
    const res = await GET(req, { params: Promise.resolve({ path: ['reservations', 'my'] }) });
    expect(res.status).toBe(401);
    expect(reservationCalls()).toEqual([]);
  });

  it('설정이 없으면 503이고 아무것도 부르지 않는다', async () => {
    vi.stubEnv('RESERVATION_ACCOUNT_SECRET', '');
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);

    expect(res.status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('예약 서비스 연결 실패(502) 본문·로그에 오류 원문이 없다', async () => {
    reservationResponse = () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:6015 secret-detail');
    };
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(JSON.parse(text).message).toBe('예약 서비스에 연결하지 못했습니다.');
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('secret-detail');
    const logged = vi.mocked(console.warn).mock.calls.flat().join(' ');
    expect(logged).not.toContain('ECONNREFUSED');
    expect(logged).not.toContain('res-token');
  });

  it('계정 준비 실패(502)도 고정 문구', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/auth/login') ? Promise.resolve(json({ message: 'db locked' }, 500)) : fakeFetch(input, init),
      ),
    );
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(JSON.parse(text).message).toBe('예약 서비스에 연결하지 못했습니다.');
    expect(text).not.toContain('db locked');
  });

  it('예약 서비스가 JSON이 아닌 본문을 주면 500 대신 502', async () => {
    reservationResponse = () => new Response('<html>Bad Gateway</html>', { status: 502 });
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(text).not.toContain('<html>');
  });

  it('예약 서비스 401은 SB 로그아웃과 구분해 502', async () => {
    reservationResponse = () => json({ message: 'Unauthorized' }, 401);
    const [req, ctx] = request('GET', ['reservations', 'my']);
    expect((await GET(req, ctx)).status).toBe(502);
  });

  it('예약 서비스의 업무 오류(409)는 상태·본문을 그대로 전달한다', async () => {
    reservationResponse = () => json({ statusCode: 409, message: '이미 예약된 시간입니다.' }, 409);
    const [req, ctx] = request('POST', ['reservations'], { ward: 'ward01', body: '{}' });
    const res = await POST(req, ctx);

    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe('이미 예약된 시간입니다.');
  });
});

// 2026-10-23 점검 지적 반영(M-1·M-2·M-5·L-1~L-4)
describe('reservation BFF route - 점검 반영', () => {
  let signupCount: number;
  let accounts: Set<string>;
  // 토큰 캐시가 모듈 전역이라 테스트마다 다른 피보호자 ID를 쓴다
  let wardKey: string;

  function accountFetch(overrides: (url: string, init?: RequestInit) => Response | null = () => null) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      // 넘기는 호출은 fakeFetch가 기록한다 - 여기서는 직접 답하는 호출만 기록
      const record = () => calls.push({ url, init });
      const override = overrides(url, init);
      if (override) {
        record();
        return override;
      }
      if (url === `${RES}/api/v1/auth/login`) {
        record();
        const { email } = JSON.parse(String(init?.body));
        // 계정마다 다른 토큰 - 남의 토큰이 쓰이는지 가린다
        return accounts.has(email) ? json({ accessToken: `token-${email}` }) : json({ message: 'no' }, 401);
      }
      if (url === `${RES}/api/v1/auth/signup`) {
        record();
        signupCount += 1;
        // 가입 처리가 잠깐 걸리는 사이 다른 요청이 들어오는 상황
        await new Promise(resolve => setTimeout(resolve, 20));
        const { email } = JSON.parse(String(init?.body));
        if (accounts.has(email)) return json({ message: '이미 등록된 이메일입니다.' }, 409);
        accounts.add(email);
        return json({ accessToken: `token-${email}` }, 201);
      }
      return fakeFetch(input, init);
    });
  }

  afterEach(tearDown);
  beforeEach(() => {
    setUp();
    wardKey = `w${Math.random().toString(36).slice(2, 7)}`;
    wards = [{ partnerUserId: wardKey, partnerName: '김영희', partnerPhone: '010-1234-5678' }];
    signupCount = 0;
    accounts = new Set();
    vi.stubGlobal('fetch', accountFetch());
  });

  it('M-1 BE 프로필 조회가 5xx면 401(로그아웃) 대신 502', async () => {
    vi.stubGlobal('fetch', accountFetch(url => (url === `${SB}/api/user/me` ? json({ message: 'down' }, 503) : null)));
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);

    expect(res.status).toBe(502);
    expect((await res.json()).message).toBe('예약 서비스에 연결하지 못했습니다.');
  });

  it('M-1 BE 프로필 조회가 401이면 그대로 401', async () => {
    vi.stubGlobal('fetch', accountFetch(url => (url === `${SB}/api/user/me` ? json({}, 401) : null)));
    const [req, ctx] = request('GET', ['reservations', 'my']);
    expect((await GET(req, ctx)).status).toBe(401);
  });

  it('M-1 연결 목록 조회가 5xx면 "연결된 피보호자 아님" 403 대신 502', async () => {
    vi.stubGlobal(
      'fetch',
      accountFetch(url => (url.includes('/connection/select') ? json({ message: 'down' }, 500) : null)),
    );
    const [req, ctx] = request('GET', ['reservations', 'my'], { ward: wardKey });
    expect((await GET(req, ctx)).status).toBe(502);
    expect(reservationCalls()).toEqual([]);
  });

  it('M-1 BE 주소 설정이 없으면 503', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_DOMAIN', '');
    const [req, ctx] = request('GET', ['reservations', 'my']);
    expect((await GET(req, ctx)).status).toBe(503);
  });

  it('M-2 같은 계정의 동시 첫 요청은 가입을 한 번만 하고 둘 다 성공한다', async () => {
    const [a, actx] = request('GET', ['reservations', 'my']);
    const [b, bctx] = request('GET', ['hospitals']);
    const [ra, rb] = await Promise.all([GET(a, actx), GET(b, bctx)]);

    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect(signupCount).toBe(1);
  });

  it('M-2 가입이 409(이미 있음)면 로그인으로 이어 간다', async () => {
    let firstLogin = true;
    vi.stubGlobal(
      'fetch',
      accountFetch(url => {
        // 첫 로그인 직후 다른 곳에서 가입이 끝난 상황
        if (url === `${RES}/api/v1/auth/login` && firstLogin) {
          firstLogin = false;
          accounts.add(`sb-${profileId}@silverbridge.local`);
          return json({ message: 'no' }, 401);
        }
        return null;
      }),
    );
    const [req, ctx] = request('GET', ['reservations', 'my']);
    expect((await GET(req, ctx)).status).toBe(200);
    expect(signupCount).toBe(1);
  });

  it('M-5 모든 외부 호출에 시간 제한 신호를 붙인다', async () => {
    const [req, ctx] = request('POST', ['reservations'], { ward: wardKey, body: '{"hospitalId":1}' });
    await POST(req, ctx);
    expect(calls.length).toBeGreaterThan(3);
    for (const call of calls) expect(call.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('M-5 시간 초과(중단)는 고정 문구 502', async () => {
    reservationResponse = () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    };
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('timeout');
  });

  it('사용자마다 자기 예약 계정 토큰만 쓴다(보호자 대리는 피보호자 계정)', async () => {
    const [own, ownCtx] = request('GET', ['reservations', 'my']);
    await GET(own, ownCtx);
    const [ward, wardCtx] = request('GET', ['reservations', 'my'], { ward: wardKey });
    await GET(ward, wardCtx);

    const [first, second] = reservationCalls().map(call => (call.init?.headers as Record<string, string>).authorization);
    expect(first).toBe(`Bearer token-sb-${profileId}@silverbridge.local`);
    expect(second).toBe(`Bearer token-sb-${wardKey}@silverbridge.local`);
  });

  it('L-1 예약 본문은 허용 필드만 넘긴다(증상·메모·응급 표시 제거)', async () => {
    const body = JSON.stringify({
      hospitalId: 1,
      department: '내과',
      reservationDate: '2026-10-24',
      reservationTime: '10:00',
      patientName: '김영희',
      phone: '010-1234-5678',
      symptomSummary: '가슴 통증',
      memo: 'x',
      emergencyFlag: true,
      userId: 99,
    });
    const [req, ctx] = request('POST', ['reservations'], { ward: wardKey, body });
    await POST(req, ctx);

    const sent = JSON.parse(String(reservationCalls()[0].init?.body));
    expect(sent).toEqual({
      hospitalId: 1,
      department: '내과',
      reservationDate: '2026-10-24',
      reservationTime: '10:00',
      patientName: '김영희',
      phone: '010-1234-5678',
    });
  });

  it.each([
    ['4KB 초과', JSON.stringify({ department: 'x'.repeat(5000) }), 413],
    ['JSON 아님', 'not json', 400],
    ['배열', '[1,2]', 400],
  ])('L-1 예약 본문이 %s면 예약 서비스를 부르지 않는다', async (_, body, status) => {
    const [req, ctx] = request('POST', ['reservations'], { ward: wardKey, body });
    expect((await POST(req, ctx)).status).toBe(status);
    expect(reservationCalls()).toEqual([]);
  });

  it('L-2 예약 서비스 401이면 토큰을 새로 받아 한 번만 다시 보낸다', async () => {
    let first = true;
    reservationResponse = () => {
      if (first) {
        first = false;
        return json({ message: 'expired' }, 401);
      }
      return json([]);
    };
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(reservationCalls()).toHaveLength(2);
  });

  it('L-2 다시 보내도 401이면 502(로그아웃시키지 않는다)', async () => {
    reservationResponse = () => json({ message: 'expired' }, 401);
    const [req, ctx] = request('GET', ['reservations', 'my']);
    expect((await GET(req, ctx)).status).toBe(502);
    expect(reservationCalls()).toHaveLength(2);
  });

  it('L-3 예약 서비스 5xx는 고정 문구 502(503 "설정 없음"과 섞지 않는다)', async () => {
    reservationResponse = () => json({ code: 'INTERNAL_ERROR', message: 'Prisma error at ...' }, 503);
    const [req, ctx] = request('GET', ['reservations', 'my']);
    const res = await GET(req, ctx);
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain('Prisma');
  });

  it('L-3 입력 검증 400(HTTP_ERROR)은 일반 문구, 업무 오류 400은 서버 문구 그대로', async () => {
    reservationResponse = () =>
      json({ success: false, code: 'HTTP_ERROR', message: 'reservationDate must be a valid ISO 8601 date string' }, 400);
    const [a, actx] = request('POST', ['reservations'], { ward: wardKey, body: '{}' });
    const validation = await POST(a, actx);
    expect(validation.status).toBe(400);
    expect((await validation.json()).message).toBe('예약 정보를 다시 확인해 주세요.');

    reservationResponse = () =>
      json({ success: false, code: 'HOSPITAL_CLOSED', message: '현재 예약 가능한 상태가 아닙니다.' }, 400);
    const [b, bctx] = request('POST', ['reservations'], { ward: wardKey, body: '{}' });
    expect((await (await POST(b, bctx)).json()).message).toBe('현재 예약 가능한 상태가 아닙니다.');
  });

  it.each([
    ['GET', ['hospitals', '9999999999', 'available-slots'], '?date=2026-10-24'],
    ['PATCH', ['reservations', '1234567890', 'cancel'], ''],
    ['GET', ['hospitals', '3', 'available-slots'], '?date=2026-02-30'],
    ['GET', ['hospitals', '3', 'available-slots'], '?date=2026-99-99'],
  ])('L-4 int32를 넘는 id·없는 날짜는 404 - %s %j %s', async (method, path, search) => {
    const [req, ctx] = request(method, path, { ward: wardKey, search });
    const handler = { GET, POST, PATCH }[method as 'GET' | 'POST' | 'PATCH'];
    expect((await handler(req, ctx)).status).toBe(404);
    expect(calls).toEqual([]);
  });
});
