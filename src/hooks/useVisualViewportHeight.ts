'use client';

import { useEffect, useState } from 'react';

// iOS Safari는 키보드를 열어도 CSS 100dvh 레이아웃을 즉시 줄이지 않는 경우가 있다.
// 실제로 보이는 visualViewport 높이를 사용해 입력창이 키보드 뒤로 밀리지 않게 한다.
export function useVisualViewportHeight(enabled: boolean) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateHeight = () => setHeight(Math.round(viewport.height));

    const initialFrame = window.requestAnimationFrame(updateHeight);
    viewport.addEventListener('resize', updateHeight);
    viewport.addEventListener('scroll', updateHeight);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      viewport.removeEventListener('resize', updateHeight);
      viewport.removeEventListener('scroll', updateHeight);
    };
  }, [enabled]);

  return height;
}
