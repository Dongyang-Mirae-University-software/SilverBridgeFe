import { NextRequest, NextResponse } from 'next/server';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'cookie',
  'host',
  'keep-alive',
  'origin',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function getStreamApiUrl(path: string[], search: string) {
  const domain = process.env.NEXT_PUBLIC_AI_API_DOMAIN;
  if (!domain) throw new Error('NEXT_PUBLIC_AI_API_DOMAIN이 설정되지 않았습니다.');
  const pathname = path.map(segment => encodeURIComponent(segment)).join('/');
  return `${domain.replace(/\/$/, '')}/api/${pathname}${search}`;
}

function getProxyRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  const apiKey = process.env.STREAM_API_KEY;

  HOP_BY_HOP_HEADERS.forEach(h => headers.delete(h));
  if (apiKey) headers.set('x-api-key', apiKey);

  return headers;
}

function getProxyResponseHeaders(response: Response) {
  const headers = new Headers(response.headers);
  HOP_BY_HOP_HEADERS.forEach(h => headers.delete(h));
  return headers;
}

// 피보호자 송출(broadcast) 3개 경로만 허용한다. 카메라 목록·영상 보기·분석 상태 같은
// 조회성 경로는 전부 백엔드 중계 API(/api/guardian/camera/**)로 옮겨갔다 — 여기 경로를
// 늘리면 인증 없이 AI 서버 전체가 다시 뚫리니(이전의 보안 취약점) 추가하지 말 것
function isAllowedBroadcastPath(path: string[]) {
  if (path[0] !== 'v1' || path[1] !== 'stream-sessions') return false;
  if (path.length === 2) return true; // POST /v1/stream-sessions (세션 생성)
  if (path.length === 4 && path[2] && (path[3] === 'frame' || path[3] === 'stop')) return true; // 프레임 업로드 · 종료
  return false;
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, message: '허용되지 않는 요청입니다.', data: null }, { status: 404 });
}

// 쿠키 존재 여부만 보는 게 아니라 우리 백엔드에 실제로 유효한 토큰인지 확인하고,
// 카메라 송출은 피보호자(WARD) 기기만 하므로 역할도 함께 검증한다.
// AI 서버는 이 프록시가 보낸 값을 그대로 믿으므로, 로그인한 본인 확인이 실제로 막아주는 효과가 있으려면
// 여기서 가짜 토큰·다른 역할 요청을 걸러내야 한다.
async function isAuthenticatedWard(request: NextRequest) {
  const accessToken = request.cookies.get('careai_access_token')?.value;
  const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
  if (!accessToken || !apiDomain) return false;

  try {
    const response = await fetch(`${apiDomain.replace(/\/$/, '')}/api/user/me`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { data?: { data?: { role?: string }; role?: string } };
    const role = body?.data?.data?.role ?? body?.data?.role;
    return role === 'WARD';
  } catch {
    return false;
  }
}

async function proxyStreamRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

  if (request.method.toUpperCase() !== 'POST' || !isAllowedBroadcastPath(path)) {
    return forbiddenResponse();
  }

  if (!(await isAuthenticatedWard(request))) {
    return NextResponse.json({ success: false, message: '로그인이 필요합니다.', data: null }, { status: 401 });
  }

  const targetUrl = getStreamApiUrl(path, request.nextUrl.search);
  const body = await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    body,
    cache: 'no-store',
    headers: getProxyRequestHeaders(request),
    method: 'POST',
    redirect: 'manual',
  });

  return new Response(response.body, {
    headers: getProxyResponseHeaders(response),
    status: response.status,
    statusText: response.statusText,
  });
}

export const POST = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
