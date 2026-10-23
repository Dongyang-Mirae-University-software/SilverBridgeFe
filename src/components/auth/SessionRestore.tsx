'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { restoreSession } from '@/lib/auth/sessionRestore';
import SessionRetryNotice from './SessionRetryNotice';

// 첫 진입에서 access 토큰이 만료됐지만 refresh 토큰이 있을 때 갱신 후 역할 홈으로 보낸다.
// 갱신이 거절되면 refreshAccessToken 이 세션을 지우고, 여기서 로그인 화면으로 보낸다
export default function SessionRestore() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void restoreSession().then(result => {
      if (cancelled) return;
      if (result.status === 'restored') router.replace(result.homePath);
      else if (result.status === 'rejected') router.replace('/login');
      else setUnavailable(true);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  if (!unavailable) return null;

  return (
    <SessionRetryNotice
      onRetry={() => {
        setUnavailable(false);
        setAttempt(value => value + 1);
      }}
    />
  );
}
