/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig } from 'vitest/config';

// 컴포넌트 테스트 - 실제 Chrome(설치된 google-chrome)에서 돌린다. `npm run test:browser`
// 단위 테스트(`npm test`, node 환경)와 분리한다: *.browser.test.tsx 만 대상
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  // vitest-browser-react 를 미리 묶으면 vitest 사본이 둘이 되어 "failed to find the runner"가 난다
  optimizeDeps: {
    exclude: ['vitest-browser-react'],
    // 테스트 도중 새로 묶으면 Vite가 페이지를 다시 읽어 테스트가 깨진다 - 쓰는 의존성을 미리 묶어 둔다
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'classnames/bind',
      '@tanstack/react-query',
      'axios',
      'dayjs',
      'dayjs/locale/ko',
      'next/link',
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [
        {
          browser: 'chromium',
          launch: { channel: 'chrome' },
          context: { viewport: { width: 375, height: 812 } },
        },
      ],
    },
  },
});
