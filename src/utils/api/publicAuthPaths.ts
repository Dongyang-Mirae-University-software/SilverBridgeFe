// 로그인 없이 부르는 인증 경로 - 브라우저 요청(apiClient)과 서버 프록시(app/api/[...path])가 같이 쓴다.
// 두 곳의 목록이 어긋나 프록시가 만료된 옛 토큰을 공개 경로에 붙여 401이 나던 일이 있었다(QA AUTH-A29)
// 자동 로그아웃 때의 푸시 토큰 해제도 인증 헤더 없이 부른다(만료된 헤더를 붙이면 401)
const PUBLIC_AUTH_PREFIXES = ['/auth/signup', '/auth/find-password', '/auth/find-email', '/auth/password/reset', '/notifications/fcm-token/release'];

export function isPublicAuthPath(url?: string) {
  if (!url) return false;
  const path = url.split('?')[0];
  return PUBLIC_AUTH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`) || path.includes(`${prefix}/`) || path.endsWith(prefix));
}
