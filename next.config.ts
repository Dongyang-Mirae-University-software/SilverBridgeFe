import type { NextConfig } from 'next';

// 모든 응답에 붙이는 보안 헤더(2026-11-10 전체 점검 S-4).
// - 다른 사이트가 우리 화면을 iframe 에 넣지 못하게 한다(SOS·탈퇴 버튼 클릭 유도 방지)
// - 카카오 로그인 콜백 주소의 code 가 다른 출처로 Referer 에 실려 나가지 않게 한다
// 스크립트 출처까지 막는 CSP 는 카카오·Firebase 출처를 정리한 뒤 따로 넣는다(여기서는 frame-ancestors 만)
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  // 카메라(송출)·마이크(음성 입력)는 우리 화면만 쓴다. 안에 넣은 다른 출처 화면(게임)에는 주지 않는다
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // 개발 서버를 외부에서 볼 때도 Next.js 개발 상태 플로팅 UI는 노출하지 않는다.
  devIndicators: false,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(','),
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
