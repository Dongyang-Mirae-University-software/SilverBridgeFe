import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // 개발 서버를 외부에서 볼 때도 Next.js 개발 상태 플로팅 UI는 노출하지 않는다.
  devIndicators: false,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(','),
};

export default nextConfig;
