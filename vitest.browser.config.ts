import { playwright } from '@vitest/browser-playwright';
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
      'react-dom/server',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'classnames/bind',
      '@tanstack/react-query',
      'axios',
      'dayjs',
      'dayjs/locale/ko',
      'next/link',
      'next/image',
      'react-hook-form',
      // LoginPage 테스트가 불러온다 - 빠지면 빈 캐시 첫 실행에서 페이지를 다시 읽어 그때 돌던 파일이 통째로 깨지고 실행이 멈춘다
      'next/headers',
    ],
  },
  esbuild: { jsx: 'automatic' },
  // Next는 NEXT_PUBLIC_* 를 빌드 때 값으로 바꾼다. 테스트 브라우저에는 process가 없어 같은 방식으로 빈 값을 넣는다
  define: { 'process.env.NEXT_PUBLIC_AI_API_DOMAIN': JSON.stringify('') },
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      provider: playwright({ launchOptions: { channel: 'chrome' } }),
      headless: true,
      viewport: { width: 375, height: 812 },
      // vitest 5부터 locator가 글자를 통째로 맞춰 본다 - 이전처럼 일부만 맞아도 찾게 둔다
      locators: { exact: false },
      instances: [{ browser: 'chromium' }],
    },
  },
});
