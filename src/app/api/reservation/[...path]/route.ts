// 병원 예약 서비스(SilverBridgeReservation) BFF 프록시.
// 예약 서비스는 자체 계정(JWT)이 필요하므로, 로그인한 사용자마다 예약 서비스 계정을
// 자동 생성/로그인해 토큰을 붙여 전달한다. 클라이언트는 /api/reservation/<예약API 경로>로 호출.
// 예약은 피보호자 계정 소유다: 보호자는 x-sb-ward-id 헤더로 연결된 피보호자 계정을 대신 쓰고,
// 피보호자 웹은 헤더 없이 자기 계정으로 같은 내역을 본다.
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { readReservationConfig, type ReservationConfig } from '@/lib/server/reservationConfig';

// 예약 서비스 주소·계정 비밀번호 파생 비밀은 환경변수로만 받는다(기본값 없음). 비어 있으면 예약 기능만 503.
const PHONE_PATTERN = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
const WARD_HEADER = 'x-sb-ward-id';

type RouteContext = { params: Promise<{ path: string[] }> };
type Profile = { id: string; name?: string; phone?: string };
type Connection = { partnerUserId: string; partnerName?: string; partnerPhone?: string | null };

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function fail(status: number, message: string) {
  return Response.json({ success: false, code: 'RESERVATION_PROXY', message }, { status });
}

function getSbToken(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return bearer || request.cookies.get('careai_access_token')?.value;
}

async function fetchSb(token: string, path: string): Promise<unknown> {
  const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
  if (!apiDomain) return null;
  const response = await fetch(`${apiDomain.replace(/\/$/, '')}${path}`, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.data?.data ?? body?.data ?? body;
}

async function getCurrentProfile(token: string): Promise<Profile | null> {
  const profile = (await fetchSb(token, '/api/user/me')) as Profile | null;
  return profile?.id ? profile : null;
}

// 보호자가 대신 예약할 피보호자. ACTIVE 연결만 허용해 남의 예약 내역을 볼 수 없게 한다.
async function getWardProfile(token: string, wardId: string): Promise<Profile | null> {
  const wards = (await fetchSb(token, '/api/guardian/connection/select?status=ACTIVE')) as Connection[] | null;
  const ward = Array.isArray(wards) ? wards.find(item => item.partnerUserId === wardId) : undefined;
  return ward ? { id: ward.partnerUserId, name: ward.partnerName, phone: ward.partnerPhone ?? undefined } : null;
}

async function postJson(config: ReservationConfig, path: string, body: unknown) {
  return fetch(`${config.apiBase}${path}`, {
    body: JSON.stringify(body),
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

async function getReservationToken(config: ReservationConfig, profile: Profile) {
  const cached = tokenCache.get(profile.id);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const email = `sb-${profile.id}@silverbridge.local`;
  const password = createHmac('sha256', config.accountSecret).update(profile.id).digest('hex');

  let response = await postJson(config, '/auth/login', { email, password });
  if (response.status === 401) {
    const phone = profile.phone && PHONE_PATTERN.test(profile.phone) ? profile.phone : '010-0000-0000';
    response = await postJson(config, '/auth/signup', { email, password, name: profile.name || '사용자', phone });
  }
  if (!response.ok) throw new Error('예약 서비스 계정을 준비하지 못했습니다.');

  const { accessToken } = (await response.json()) as { accessToken: string };
  tokenCache.set(profile.id, { token: accessToken, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
  return accessToken;
}

async function proxyReservationRequest(request: NextRequest, context: RouteContext) {
  const config = readReservationConfig();
  if (!config) return fail(503, '예약 서비스 설정이 되어 있지 않습니다.');

  const sbToken = getSbToken(request);
  const me = sbToken ? await getCurrentProfile(sbToken) : null;
  if (!sbToken || !me) return fail(401, '로그인이 필요해요.');

  const wardId = request.headers.get(WARD_HEADER);
  const profile = wardId ? await getWardProfile(sbToken, wardId) : me;
  if (!profile) return fail(403, '연결된 피보호자가 아니에요.');

  let token: string;
  try {
    token = await getReservationToken(config, profile);
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : '예약 서비스에 연결하지 못했습니다.');
  }

  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const targetUrl = `${config.apiBase}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

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
