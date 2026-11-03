'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import SessionCheckingNotice from '@/components/auth/SessionCheckingNotice';
import { restoreSession } from '@/lib/auth/sessionRestore';

interface Props {
  // access 토큰은 없거나 만료됐고 refresh 토큰만 있을 때(서버가 resolveEntry 로 판단) true
  restore: boolean;
  returnTo: string | null;
  children: ReactNode;
}

// 로그인 화면에 들어온 사람의 세션을 첫 화면(/)과 같은 기준으로 확인한다.
// 갱신되면 홈으로 보내고, 거절(세션은 refreshAccessToken 이 이미 지움)·일시 장애(세션 유지)면 폼을 그대로 보인다
export default function LoginSessionGate({ restore, returnTo, children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(restore);

  useEffect(() => {
    if (!restore) return;

    let cancelled = false;
    void restoreSession().then(result => {
      if (cancelled) return;
      // 갱신되면 이동이 끝날 때까지 안내를 그대로 둔다(폼이 잠깐 보이지 않게)
      if (result.status === 'restored') router.replace(returnTo ?? result.homePath);
      else setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [restore, returnTo, router]);

  if (checking) return <SessionCheckingNotice inline />;

  return children;
}
