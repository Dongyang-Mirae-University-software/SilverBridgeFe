// 병원 예약 서비스(SilverBridgeReservation) BFF 프록시.
// 예약 서비스는 자체 계정(JWT)이 필요하므로, 로그인한 보호자마다 예약 서비스 계정을
// 자동 생성/로그인해 토큰을 붙여 전달한다. 클라이언트는 /api/reservation/<예약API 경로>로 호출.
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

const RESERVATION_API = `${(process.env.RESERVATION_API_URL ?? 'https://reservation.dmu.gosky.kr').replace(/\/$/, '')}/api/v1`;
// ponytail: 예약 서비스 계정 비밀번호 파생용. 운영에서는 RESERVATION_ACCOUNT_SECRET로 반드시 덮어쓸 것.
const ACCOUNT_SECRET = process.env.RESERVATION_ACCOUNT_SECRET ?? 'silverbridge-reservation-dev-secret';
const PHONE_PATTERN = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;

type RouteContext = { params: Promise<{ path: string[] }> };
type Profile = { id: string; name?: string; phone?: string };

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function fail(status: number, message: string) {
  return Response.json({ success: false, code: 'RESERVATION_PROXY', message }, { status });
}

async function getCurrentProfile(request: NextRequest): Promise<Profile | null> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const token = bearer || request.cookies.get('careai_access_token')?.value;
  const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
  if (!token || !apiDomain) return null;

  const response = await fetch(`${apiDomain.replace(/\/$/, '')}/api/user/me`, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;

  const body = await response.json();
  const profile = (body?.data?.data ?? body?.data ?? body) as Profile | undefined;
  return profile?.id ? profile : null;
}

async function postJson(path: string, body: unknown) {
  return fetch(`${RESERVATION_API}${path}`, {
    body: JSON.stringify(body),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

async function getReservationToken(profile: Profile) {
  const cached = tokenCache.get(profile.id);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const email = `sb-${profile.id}@silverbridge.local`;
  const password = createHmac('sha256', ACCOUNT_SECRET).update(profile.id).digest('hex');

  let response = await postJson('/auth/login', { email, password });
  if (response.status === 401) {
    const phone = profile.phone && PHONE_PATTERN.test(profile.phone) ? profile.phone : '010-0000-0000';
    response = await postJson('/auth/signup', { email, password, name: profile.name || '보호자', phone });
  }
  if (!response.ok) throw new Error('예약 서비스 계정을 준비하지 못했습니다.');

  const { accessToken } = (await response.json()) as { accessToken: string };
  tokenCache.set(profile.id, { token: accessToken, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
  return accessToken;
}

async function proxyReservationRequest(request: NextRequest, context: RouteContext) {
  const profile = await getCurrentProfile(request);
  if (!profile) return fail(401, '로그인이 필요해요.');

  let token: string;
  try {
    token = await getReservationToken(profile);
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : '예약 서비스에 연결하지 못했습니다.');
  }

  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const targetUrl = `${RESERVATION_API}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const response = await fetch(targetUrl, {
    body,
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    method,
  });

  // 예약 서비스 토큰 만료 등은 SB 세션 만료(401)와 구분해야 apiClient가 로그아웃 처리하지 않는다.
  if (response.status === 401) {
    tokenCache.delete(profile.id);
    return fail(502, '예약 서비스 인증이 만료되었습니다. 다시 시도해주세요.');
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return Response.json(response.ok ? { success: true, data } : data, { status: response.status });
}

export const GET = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
export const POST = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
export const PATCH = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
export const DELETE = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
