import type { MetadataRoute } from 'next';

// 홈 화면에 추가했을 때의 이름·아이콘. 아이콘은 scripts/build-push-icons.mjs 가 만든다
// (아이폰 홈 화면은 manifest 대신 같은 폴더의 apple-icon.png 를 쓴다)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '실버브릿지',
    short_name: '실버브릿지',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf6f0',
    theme_color: '#b0674d',
    icons: [
      { src: '/icons/push/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/push/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/push/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
