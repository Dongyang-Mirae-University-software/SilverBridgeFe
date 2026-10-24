'use client';

import { useEffect, useState } from 'react';

import { kstNowTime, kstToday } from './reservationView';

const TICK_MS = 60 * 1000;

// 화면을 오래 열어 두어도 '오늘'·'지금'이 1분 안에 따라오게 한다(자정·지난 시각 표시)
export function useKstNow() {
  const [now, setNow] = useState(() => ({ today: kstToday(), nowTime: kstNowTime() }));
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = { today: kstToday(), nowTime: kstNowTime() };
      setNow(prev => (prev.today === next.today && prev.nowTime === next.nowTime ? prev : next));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
