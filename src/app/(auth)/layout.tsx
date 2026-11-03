import type { Viewport } from 'next';

import AuthShell from './_components/AuthShell';

// 인증 화면만 노치·홈 막대 영역까지 그리고(cover), AuthShell 이 safe-area 만큼 안쪽 여백을 둔다.
// 앱 전체(root layout)는 그대로 - 다른 화면은 이 설정 없이 지금처럼 안전 영역 안에만 그려진다.
export const viewport: Viewport = { viewportFit: 'cover' };

export default function Layout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <>
      <AuthShell>{children}</AuthShell>
      {modal}
    </>
  );
}
