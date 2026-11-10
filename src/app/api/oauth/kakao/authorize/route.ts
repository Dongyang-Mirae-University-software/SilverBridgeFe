import { NextRequest, NextResponse } from 'next/server';
import { getSafeReturnPath } from '@/lib/auth/returnPath';
import { KAKAO_STATE_COOKIE, KAKAO_STATE_MAX_AGE_SECONDS, buildKakaoState } from '@/lib/auth/kakaoState';

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_CALLBACK_PATH = '/oauth';

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim() || process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID?.trim();
  const redirectUri =
    process.env.KAKAO_REDIRECT_URI?.trim() ||
    process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI?.trim() ||
    `${getRequestOrigin(request)}${KAKAO_CALLBACK_PATH}`;

  if (!clientId) {
    return NextResponse.json({ message: 'KAKAO_REST_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
  });

  // state 에는 이 브라우저에만 있는 난수를 싣고 같은 값을 쿠키에 둔다 - 콜백 화면이 둘을 대조한다(로그인 CSRF 방지).
  // 콜백 화면(브라우저 코드)이 읽어야 해서 HttpOnly 가 아니다. 토큰이 아니라 10분짜리 일회용 난수다
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const returnTo = getSafeReturnPath(request.nextUrl.searchParams.get('returnTo'));
  params.set('state', buildKakaoState(nonce, returnTo));

  const response = NextResponse.redirect(`${KAKAO_AUTHORIZE_URL}?${params.toString()}`);
  response.cookies.set(KAKAO_STATE_COOKIE, nonce, {
    maxAge: KAKAO_STATE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: getRequestOrigin(request).startsWith('https://'),
  });
  return response;
}
