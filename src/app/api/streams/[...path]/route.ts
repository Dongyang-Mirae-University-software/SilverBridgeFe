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

async function proxyStreamRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = getStreamApiUrl(path, request.nextUrl.search);
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    body,
    cache: 'no-store',
    headers: getProxyRequestHeaders(request),
    method,
    redirect: 'manual',
  });

  return new Response(response.body, {
    headers: getProxyResponseHeaders(response),
    status: response.status,
    statusText: response.statusText,
  });
}

export const GET = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
export const POST = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
export const PUT = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
export const PATCH = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
export const DELETE = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
export const OPTIONS = (req: NextRequest, ctx: RouteContext) => proxyStreamRequest(req, ctx);
