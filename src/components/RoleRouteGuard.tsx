'use client';

import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { myProfileQueryOptions } from '@/service/query/user';
import { getRoleHomePath } from '@/utils/auth/routes';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { AuthRole, clearAuthTokens, getAccessToken, getRefreshToken, setAuthRole } from '@/lib/auth/tokenStore';
import { restoreSession, shouldEndSessionAfterProfileError } from '@/lib/auth/sessionRestore';
import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import { reportNonApiError } from '@/lib/api/reportError';
import SessionCheckingNotice from '@/components/auth/SessionCheckingNotice';
import SessionRetryNotice from '@/components/auth/SessionRetryNotice';

const subscribeNothing = () => () => {};

interface Props {
  allowedRole: AuthRole;
  children: ReactNode;
}

export default function RoleRouteGuard({ allowedRole, children }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken();
  // access 쿠키가 없어도 refresh 토큰이 있으면 로그인 화면으로 보내기 전에 먼저 갱신한다
  const needsRestore = !accessToken && Boolean(getRefreshToken());
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreUnavailable, setRestoreUnavailable] = useState(false);
  const [, setRestoredCount] = useState(0);
  // 서버 렌더와 하이드레이션 첫 렌더는 쿠키를 모르므로(null) 둘 다 아무것도 그리지 않는다 - 그 뒤에만 안내를 그린다
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const { data: profileResponse, error, isError, isLoading, refetch } = useQuery({
    ...myProfileQueryOptions,
    enabled: Boolean(accessToken),
  });
  const profile = getUserProfileData(profileResponse);
  const isAllowed = Boolean(accessToken && profile?.role === allowedRole);
  const endsSession = isError && shouldEndSessionAfterProfileError(error, Boolean(getRefreshToken()));

  useEffect(() => {
    if (!needsRestore) return;

    let cancelled = false;
    void restoreSession().then(result => {
      if (cancelled) return;
      // 새 토큰은 tokenStore 에 저장됐다 - 다시 그려 getAccessToken() 으로 읽게 한다
      if (result.status === 'restored') setRestoredCount(value => value + 1);
      else if (result.status === 'rejected') router.replace('/login');
      else setRestoreUnavailable(true);
    });

    return () => {
      cancelled = true;
    };
  }, [needsRestore, restoreAttempt, router]);

  useEffect(() => {
    if (!accessToken) {
      if (!needsRestore) router.replace('/login');
      return;
    }

    if (isError) {
      // 일시 장애(갱신 5xx·프로필 5xx·네트워크)로는 로그아웃시키지 않고 다시 시도 안내를 보인다
      if (endsSession) {
        clearAuthTokens();
        router.replace('/login');
      }
      return;
    }

    if (profile?.role) {
      setAuthRole(profile.role);
    }

    if (profile?.role && profile.role !== allowedRole) {
      router.replace(getRoleHomePath(profile.role));
    }
  }, [accessToken, allowedRole, endsSession, isError, needsRestore, profile?.role, router]);

  useEffect(() => {
    if (!accessToken) return;

    void queryClient.prefetchQuery(myProfileQueryOptions);
  }, [accessToken, queryClient]);

  useEffect(() => {
    if (!isAllowed) return;

    void registerFcmTokenForCurrentDevice().catch(error => {
      reportNonApiError('FCM 토큰 등록 실패:', error);
    });
  }, [isAllowed]);

  if (needsRestore && restoreUnavailable) {
    return (
      <SessionRetryNotice
        onRetry={() => {
          setRestoreUnavailable(false);
          setRestoreAttempt(value => value + 1);
        }}
      />
    );
  }

  if (needsRestore) return hydrated ? <SessionCheckingNotice /> : null;

  if (isError && !endsSession) return <SessionRetryNotice onRetry={() => void refetch()} />;

  if (isLoading || !isAllowed) return null;

  return children;
}
