'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import SessionCheckingNotice from '@/components/auth/SessionCheckingNotice';
import { endLeftoverSession } from '@/lib/api/apiClient';
import { restoreSession } from '@/lib/auth/sessionRestore';

interface Props {
  // access 토큰은 없거나 만료됐고 로그인 세션 표시만 있을 때(서버가 resolveEntry 로 판단) true
  restore: boolean;
  // "로그인 유지"를 끈 로그인의 흔적만 남았을 때 true - 폼을 보이기 전에 서버에 남은 세션을 끝낸다
  endLeftover?: boolean;
  returnTo: string | null;
  children: ReactNode;
}

// 로그인 화면에 들어온 사람의 세션을 첫 화면(/)과 같은 기준으로 확인한다.
// 갱신되면 홈으로 보내고, 거절(세션은 refreshAccessToken 이 이미 지움)·일시 장애(세션 유지)면 폼을 그대로 보인다
export default function LoginSessionGate({ restore, endLeftover = false, returnTo, children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(restore || endLeftover);

  useEffect(() => {
    if (!restore && !endLeftover) return;

    let cancelled = false;
    if (!restore) {
      // 끝내는 동안 폼을 막는다 - 그 사이 새로 로그인하면 방금 만든 세션까지 함께 끝날 수 있다
      void endLeftoverSession().finally(() => {
        if (!cancelled) setChecking(false);
      });
      return () => {
        cancelled = true;
      };
    }

    void restoreSession().then(result => {
      if (cancelled) return;
      // 갱신되면 이동이 끝날 때까지 안내를 그대로 둔다(폼이 잠깐 보이지 않게)
      if (result.status === 'restored') router.replace(returnTo ?? result.homePath);
      else setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [endLeftover, restore, returnTo, router]);

  if (checking) return <SessionCheckingNotice inline />;

  return children;
}
