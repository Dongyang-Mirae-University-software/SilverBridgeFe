'use client';

import { useEffect, useState } from 'react';

// 화면 키보드가 떠 있는지 visualViewport 높이로 판단한다.
// 안드로이드는 키보드를 내려도 입력창 포커스가 남아 :focus 기준으로는 숨긴 영역이 돌아오지 않는다.
// 키보드가 레이아웃까지 줄이는 브라우저도 있어 window.innerHeight와 비교하지 않고, 본 적 있는 가장 큰 높이와 비교한다.
export function useSoftKeyboardOpen(threshold = 120) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let width = viewport.width;
    let baseline = viewport.height;

    const update = () => {
      // 화면 회전·창 크기 변경은 새 기준으로 다시 잰다
      if (Math.abs(viewport.width - width) > 1) {
        width = viewport.width;
        baseline = viewport.height;
      }
      baseline = Math.max(baseline, viewport.height);
      setOpen(baseline - viewport.height > threshold);
    };

    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, [threshold]);

  return open;
}
