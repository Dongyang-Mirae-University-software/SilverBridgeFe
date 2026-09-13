'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getMsUntilNextKstMidnight() {
  const now = Date.now();
  const kstNow = new Date(now + KST_OFFSET_MS);
  const nextKstMidnightUtc = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + 1);
  return nextKstMidnightUtc - KST_OFFSET_MS - now;
}

// 복약 doseDate는 항상 KST 기준이라, 화면을 열어 둔 채 자정(KST)이 지나면
// 새 날짜의 일정으로 자동 재조회한다
export default function useKstMidnightRefetch(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = Math.max(getMsUntilNextKstMidnight(), 1000);
      timeoutId = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey });
        schedule();
      }, delay);
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [queryClient, queryKey]);
}
