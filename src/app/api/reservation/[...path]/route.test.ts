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

describe('reservation BFF route', () => {
  beforeEach(() => {
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
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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
