// 병원 예약 서비스(SilverBridgeReservation) BFF 프록시.
// 예약 서비스는 자체 계정(JWT)이 필요하므로, 로그인한 사용자마다 예약 서비스 계정을
// 자동 생성/로그인해 토큰을 붙여 전달한다. 클라이언트는 /api/reservation/<예약API 경로>로 호출.
// 예약은 피보호자 계정 소유다: 보호자는 x-sb-ward-id 헤더로 연결된 피보호자 계정을 대신 쓰고,
// 피보호자 웹은 헤더 없이 자기 계정으로 같은 내역을 본다.
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { readReservationConfig, type ReservationConfig } from '@/lib/server/reservationConfig';
import { matchReservationRoute } from '@/lib/server/reservationRoutes';

// 예약 서비스 주소·계정 비밀번호 파생 비밀은 환경변수로만 받는다(기본값 없음). 비어 있으면 예약 기능만 503.
const PHONE_PATTERN = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
const WARD_HEADER = 'x-sb-ward-id';
const UPSTREAM_FAILED_MESSAGE = '예약 서비스에 연결하지 못했습니다.';
// 외부 호출(SB 백엔드·예약 서비스)마다 이 시간 안에 끝나지 않으면 끊는다
const CALL_TIMEOUT_MS = 10_000;
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const TOKEN_CACHE_MAX = 500;
const MAX_BODY_BYTES = 4096;
// 예약 만들기 본문은 화면이 보내는 필드만 다시 조립한다(증상·메모·응급 표시 등은 넘기지 않는다)
const CREATE_FIELDS = [
  'hospitalId',
  'department',
  'reservationDate',
  'reservationTime',
  'patientName',
  'phone',
  'birthDate',
  'guardianName',
  'guardianPhone',
] as const;

type RouteContext = { params: Promise<{ path: string[] }> };
type Profile = { id: string; name?: string; phone?: string };
type Connection = { partnerUserId: string; partnerName?: string; partnerPhone?: string | null };

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
// 같은 계정의 동시 첫 요청이 각자 가입하다 409로 실패하지 않도록 진행 중인 발급을 함께 기다린다
const tokenInFlight = new Map<string, Promise<string>>();

// 원문 대신 고정 코드만 들고 다니는 실패. status는 BFF가 내보낼 상태(503 설정 없음 / 502 연결 실패)
class ProxyFailure extends Error {
  constructor(
    readonly status: 502 | 503,
    readonly code: string,
  ) {
    super(code);
  }
}

const withTimeout = <T extends RequestInit>(init: T) => ({ ...init, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });

function fail(status: number, message: string) {
  return Response.json({ success: false, code: 'RESERVATION_PROXY', message }, { status });
}

function getSbToken(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return bearer || request.cookies.get('careai_access_token')?.value;
}

async function fetchSb(token: string, path: string): Promise<unknown> {
  const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
  if (!apiDomain) throw new ProxyFailure(503, 'SB_DOMAIN_MISSING');
  const response = await fetch(
    `${apiDomain.replace(/\/$/, '')}${path}`,
    withTimeout({ cache: 'no-store' as const, headers: { authorization: `Bearer ${token}` } }),
  );
  // 401·403만 "로그인·권한 없음"이다. 5xx·429를 null로 바꾸면 BFF가 401을 내 apiClient가 로그아웃시킨다.
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new ProxyFailure(502, 'SB_LOOKUP_FAILED');
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
  return fetch(
    `${config.apiBase}${path}`,
    withTimeout({
      body: JSON.stringify(body),
      cache: 'no-store' as const,
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }),
  );
}

async function issueReservationToken(config: ReservationConfig, profile: Profile) {
  const email = `sb-${profile.id}@silverbridge.local`;
  const password = createHmac('sha256', config.accountSecret).update(profile.id).digest('hex');

  let response = await postJson(config, '/auth/login', { email, password });
  if (response.status === 401) {
    const phone = profile.phone && PHONE_PATTERN.test(profile.phone) ? profile.phone : '010-0000-0000';
    response = await postJson(config, '/auth/signup', { email, password, name: profile.name || '사용자', phone });
    // 다른 인스턴스·요청이 먼저 가입했으면 로그인으로 이어 간다
    if (response.status === 409) response = await postJson(config, '/auth/login', { email, password });
  }
  if (!response.ok) throw new ProxyFailure(502, 'ACCOUNT_FAILED');

  const { accessToken } = (await response.json()) as { accessToken: string };
  if (!accessToken) throw new ProxyFailure(502, 'ACCOUNT_FAILED');
  return accessToken;
}

function rememberToken(id: string, token: string) {
  const now = Date.now();
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    for (const [key, entry] of tokenCache) if (entry.expiresAt <= now) tokenCache.delete(key);
    // 만료 청소 뒤에도 가득 차면 가장 오래된 항목부터 버린다(Map은 삽입 순서 유지)
    while (tokenCache.size >= TOKEN_CACHE_MAX) tokenCache.delete(tokenCache.keys().next().value as string);
  }
  tokenCache.set(id, { token, expiresAt: now + TOKEN_TTL_MS });
}

async function getReservationToken(config: ReservationConfig, profile: Profile, { fresh = false } = {}) {
  if (fresh) tokenCache.delete(profile.id);
  const cached = tokenCache.get(profile.id);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const pending = tokenInFlight.get(profile.id);
  if (pending) return pending;
  const issuing = issueReservationToken(config, profile)
    .then(token => {
      rememberToken(profile.id, token);
      return token;
    })
    .finally(() => tokenInFlight.delete(profile.id));
  tokenInFlight.set(profile.id, issuing);
  return issuing;
}

// 연결 실패는 원문(예외 메시지·응답 본문)을 내보내지 않고 고정 문구만 준다. 로그에도 고정 코드만 남긴다.
function upstreamFailed(code: string) {
  console.warn(`[RESERVATION-PROXY] ${code}`);
  return fail(502, UPSTREAM_FAILED_MESSAGE);
}

function lookupFailed(error: unknown, code: string) {
  if (error instanceof ProxyFailure && error.status === 503) {
    console.warn(`[RESERVATION-PROXY] ${error.code}`);
    return fail(503, '예약 서비스 설정이 되어 있지 않습니다.');
  }
  return upstreamFailed(error instanceof ProxyFailure ? error.code : code);
}

// 예약 만들기 본문: 4KB 이하 JSON 객체에서 허용 필드만 남긴다. 틀리면 null.
async function readCreateBody(request: NextRequest): Promise<string | 'too-large' | null> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return 'too-large';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  const picked = Object.fromEntries(CREATE_FIELDS.filter(key => key in source).map(key => [key, source[key]]));
  return JSON.stringify(picked);
}

async function proxyReservationRequest(request: NextRequest, context: RouteContext) {
  const config = readReservationConfig();
  if (!config) return fail(503, '예약 서비스 설정이 되어 있지 않습니다.');

  // 허용 목록 밖은 로그인 확인·예약 서비스 호출 없이 404
  const { path } = await context.params;
  const route = matchReservationRoute(request.method, path, request.nextUrl.searchParams);
  if (!route) return fail(404, '찾을 수 없는 요청입니다.');

  const sbToken = getSbToken(request);
  let me: Profile | null;
  try {
    me = sbToken ? await getCurrentProfile(sbToken) : null;
  } catch (error) {
    return lookupFailed(error, 'PROFILE_LOOKUP_FAILED');
  }
  if (!sbToken || !me) return fail(401, '로그인이 필요해요.');

  // 예약을 만들고 취소하는 건 보호자가 피보호자 대신 할 때뿐이다(피보호자 화면은 조회 전용).
  const wardId = request.headers.get(WARD_HEADER);
  if (route.write && !wardId) return fail(403, '보호자만 예약하거나 취소할 수 있어요.');

  let profile: Profile | null;
  try {
    profile = wardId ? await getWardProfile(sbToken, wardId) : me;
  } catch (error) {
    return lookupFailed(error, 'WARD_LOOKUP_FAILED');
  }
  if (!profile) return fail(403, '연결된 피보호자가 아니에요.');

  let body: string | undefined;
  if (route.body) {
    const created = await readCreateBody(request);
    if (created === 'too-large') return fail(413, '요청이 너무 커요.');
    if (created === null) return fail(400, '예약 정보를 다시 확인해 주세요.');
    body = created;
  }

  const send = (token: string) =>
    fetch(
      `${config.apiBase}${route.path}${route.search}`,
      withTimeout({
        body,
        cache: 'no-store' as const,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        method: request.method.toUpperCase(),
      }),
    );

  let response: Response;
  try {
    response = await send(await getReservationToken(config, profile));
    // 예약 서비스 토큰이 만료·무효(재시작으로 비밀값 교체 등)면 한 번만 새로 받아 다시 보낸다.
    // 401은 처리 전에 거절된 것이라 쓰기 요청도 다시 보내도 안전하다.
    if (response.status === 401) response = await send(await getReservationToken(config, profile, { fresh: true }));
  } catch (error) {
    return upstreamFailed(error instanceof ProxyFailure ? error.code : 'FETCH_FAILED');
  }

  // 그래도 401이면 SB 세션 만료(401)와 구분해야 apiClient가 로그아웃 처리하지 않는다.
  if (response.status === 401) {
    tokenCache.delete(profile.id);
    return upstreamFailed('UPSTREAM_UNAUTHORIZED');
  }
  // 예약 서비스 자체 오류는 BFF의 503(설정 없음)과 섞이지 않게 연결 실패로 통일한다
  if (response.status >= 500) return upstreamFailed('UPSTREAM_ERROR');

  let data: unknown;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    return upstreamFailed('UPSTREAM_BODY_INVALID');
  }
  if (response.ok) return Response.json({ success: true, data }, { status: response.status });

  // 입력 검증 실패(HTTP_ERROR 400)는 영어 문구일 수 있어 일반 문구로 바꾼다. 업무 오류(고유 code)는 서버 문구 그대로.
  const error = (data && typeof data === 'object' ? data : {}) as { code?: unknown };
  if (response.status === 400 && (error.code === 'HTTP_ERROR' || typeof error.code !== 'string')) {
    return Response.json(
      { success: false, code: 'INVALID_REQUEST', message: '예약 정보를 다시 확인해 주세요.' },
      { status: 400 },
    );
  }
  return Response.json(data, { status: response.status });
}

export const GET = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
export const POST = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
export const PATCH = (req: NextRequest, ctx: RouteContext) => proxyReservationRequest(req, ctx);
