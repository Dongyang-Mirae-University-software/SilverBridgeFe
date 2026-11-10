const KAKAO_CALLBACK_PATH = '/oauth';

export function getKakaoRedirectUri() {
  const configuredRedirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI?.trim();
  if (configuredRedirectUri) return configuredRedirectUri;

  if (typeof window === 'undefined') return KAKAO_CALLBACK_PATH;
  return `${window.location.origin}${KAKAO_CALLBACK_PATH}`;
}
