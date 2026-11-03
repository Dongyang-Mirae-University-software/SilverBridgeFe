/**
 * 로그인·가입 뒤에 돌아갈 내부 경로만 허용한다.
 * 외부 URL이나 protocol-relative URL은 절대 반환하지 않아 오픈 리다이렉트를 막는다.
 */
export function getSafeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;

  try {
    const url = new URL(value, 'https://silverbridge.local');
    return url.origin === 'https://silverbridge.local' ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function getCurrentReturnPath() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}
