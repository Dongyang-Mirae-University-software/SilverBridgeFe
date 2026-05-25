import { NextRequest, NextResponse } from 'next/server';

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

  return NextResponse.redirect(`${KAKAO_AUTHORIZE_URL}?${params.toString()}`);
}
