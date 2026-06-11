import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(','),
  devIndicators: false,
};

export default nextConfig;
