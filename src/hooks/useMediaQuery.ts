import { useSyncExternalStore } from 'react';

// CSS 미디어 쿼리 일치 여부. 서버 렌더·matchMedia가 없는 환경에서는 false(좁은 화면 기준)로 그린다
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    onChange => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}
