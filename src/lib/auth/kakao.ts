const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_CALLBACK_PATH = '/auth/kakao/callback';

export function getKakaoRedirectUri() {
  const configuredRedirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI?.trim();
  if (configuredRedirectUri) return configuredRedirectUri;

  if (typeof window === 'undefined') return KAKAO_CALLBACK_PATH;
  return `${window.location.origin}${KAKAO_CALLBACK_PATH}`;
}

export function getKakaoAuthorizeUrl() {
  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_KAKAO_CLIENT_ID가 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getKakaoRedirectUri(),
    response_type: 'code',
  });

  return `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
}
