import { NextRequest } from 'next/server';

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

// 백엔드가 내리는 HttpOnly refresh 쿠키. 브라우저는 /api/auth/* 요청에 이 쿠키를 싣는다(Path=/api/auth)
const REFRESH_COOKIE_NAME = 'careai_rt';

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function getBackendApiUrl(path: string[], search: string) {
  const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;

  if (!apiDomain) {
    throw new Error('NEXT_PUBLIC_API_DOMAIN이 설정되지 않았습니다.');
  }

  const pathname = path.map(segment => encodeURIComponent(segment)).join('/');
  return `${apiDomain.replace(/\/$/, '')}/api/${pathname}${search}`;
}

function shouldAttachCookieAccessToken(path: string[]) {
  const normalizedPath = `/${path.join('/')}`;

  return normalizedPath !== '/auth/signin' && normalizedPath !== '/auth/signin/kakao' && normalizedPath !== '/auth/refresh';
}

function isRefreshPath(path: string[]) {
  return `/${path.join('/')}` === '/auth/refresh';
}

function getProxyRequestHeaders(request: NextRequest, path: string[]) {
  const headers = new Headers(request.headers);
  const accessToken = request.cookies.get('careai_access_token')?.value;

  HOP_BY_HOP_HEADERS.forEach(header => headers.delete(header));
  if (isRefreshPath(path)) {
    headers.delete('authorization');
    // 요청 쿠키는 위에서 모두 지운다. 갱신 경로에만 refresh 쿠키 하나를 다시 실어 보낸다 -
    // 다른 경로·다른 쿠키는 넘기지 않는다(백엔드는 Authorization 헤더로만 인증한다)
    const refreshCookie = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (refreshCookie) headers.set('cookie', `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshCookie)}`);
  }
  if (!headers.has('authorization') && accessToken && shouldAttachCookieAccessToken(path)) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

function getProxyResponseHeaders(response: Response) {
  const headers = new Headers(response.headers);

  HOP_BY_HOP_HEADERS.forEach(header => headers.delete(header));

  return headers;
}

async function proxyApiRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = getBackendApiUrl(path, request.nextUrl.search);
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const response = await fetch(targetUrl, {
    body,
    cache: 'no-store',
    headers: getProxyRequestHeaders(request, path),
    method,
    redirect: 'manual',
  });

  return new Response(response.body, {
    headers: getProxyResponseHeaders(response),
    status: response.status,
    statusText: response.statusText,
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}
