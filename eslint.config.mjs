import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // React Compiler용 규칙(eslint-plugin-react-hooks 7)은 경고로 둔다 - 이 저장소는 React Compiler를 켜지 않았다(next.config.ts).
  // 걸린 곳은 카메라 송출·이상감지 클립·푸시 토스트의 최신 값 ref·effect 안 상태 초기화라, 규칙에 맞추면 값이 바뀌는 시점이 달라진다.
  // React Compiler를 켤 때 오류로 되돌리고 그 코드를 함께 고친다
  {
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  // src/lib/server 는 서버 비밀값(예약 계정 비밀·송출 키 확인)을 다룬다 - BFF 라우트(src/app/api)에서만 가져다 쓴다.
  // 화면 코드가 가져가면 그 코드가 브라우저 번들에 실린다(2026-11-10 전체 점검 S-11)
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/api/**', 'src/lib/server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/lib/server/*', '**/lib/server/*'], message: 'src/lib/server 는 src/app/api 에서만 가져다 쓴다.' }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
