'use client';

import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { myProfileQueryOptions } from '@/service/query/user';
import { getRoleHomePath } from '@/utils/auth/routes';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { AuthRole, clearAuthTokens, getAccessToken, hasSession, setAuthRole } from '@/lib/auth/tokenStore';
import { restoreSession, shouldEndSessionAfterProfileError } from '@/lib/auth/sessionRestore';
import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import { reportNonApiError } from '@/lib/api/reportError';
import SessionCheckingNotice from '@/components/auth/SessionCheckingNotice';
import SessionRetryNotice from '@/components/auth/SessionRetryNotice';
import { getSafeReturnPath } from '@/lib/auth/returnPath';

const subscribeNothing = () => () => {};

interface Props {
  allowedRole: AuthRole;
  children: ReactNode;
  roleMismatchMessage?: string;
}

export default function RoleRouteGuard({ allowedRole, children, roleMismatchMessage }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken();
  // access 쿠키가 없어도(30분 뒤 사라진다) 로그인 세션 표시가 있으면 로그인 화면으로 보내기 전에 먼저 갱신한다
  const needsRestore = !accessToken && hasSession();
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreUnavailable, setRestoreUnavailable] = useState(false);
  const [, setRestoredCount] = useState(0);
  // 서버 렌더와 하이드레이션 첫 렌더는 쿠키를 모르므로(null) 둘 다 아무것도 그리지 않는다 - 그 뒤에만 안내를 그린다
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const isGuardianRegisterPath = hydrated && isCurrentGuardianRegisterPath();
  const { data: profileResponse, error, isError, isLoading, refetch } = useQuery({
    ...myProfileQueryOptions,
    enabled: Boolean(accessToken),
  });
  const profile = getUserProfileData(profileResponse);
  const isAllowed = Boolean(accessToken && profile?.role === allowedRole);
  const endsSession = isError && shouldEndSessionAfterProfileError(error, hasSession());

  useEffect(() => {
    if (!needsRestore) return;

    let cancelled = false;
    void restoreSession().then(result => {
      if (cancelled) return;
      // 새 토큰은 tokenStore 에 저장됐다 - 다시 그려 getAccessToken() 으로 읽게 한다
      if (result.status === 'restored') setRestoredCount(value => value + 1);
      else if (result.status === 'rejected') router.replace(getLoginPath());
      else setRestoreUnavailable(true);
    });

    return () => {
      cancelled = true;
    };
  }, [needsRestore, restoreAttempt, router]);

  useEffect(() => {
    if (!accessToken) {
      if (!needsRestore) router.replace(getLoginPath());
      return;
    }

    if (isError) {
      // 일시 장애(갱신 5xx·프로필 5xx·네트워크)로는 로그아웃시키지 않고 다시 시도 안내를 보인다
      if (endsSession) {
        clearAuthTokens();
        router.replace(getLoginPath());
      }
      return;
    }

    if (profile?.role) {
      setAuthRole(profile.role);
    }

    if (profile?.role && profile.role !== allowedRole) {
      if (isGuardianRegisterPath && roleMismatchMessage) return;
      router.replace(getRoleHomePath(profile.role));
    }
  }, [accessToken, allowedRole, endsSession, isError, isGuardianRegisterPath, needsRestore, profile?.role, roleMismatchMessage, router]);

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

  if (isLoading || !isAllowed) {
    if (
      accessToken &&
      isGuardianRegisterPath &&
      profile?.role &&
      profile.role !== allowedRole &&
      roleMismatchMessage
    ) {
      return <div role="alert" style={{ padding: '48px 24px', textAlign: 'center' }}>{roleMismatchMessage}</div>;
    }
    // 프로필 조회·역할 홈 이동 중에도 빈 화면 대신 확인 중 안내를 보인다(금방 끝나면 늦게 떠서 깜빡이지 않는다)
    return hydrated ? <SessionCheckingNotice /> : null;
  }

  return children;
}

function isCurrentGuardianRegisterPath() {
  return typeof window !== 'undefined' && window.location.pathname === '/guardian/wards/register';
}

function getLoginPath() {
  if (!isCurrentGuardianRegisterPath()) return '/login';
  const returnTo = getSafeReturnPath(`${window.location.pathname}${window.location.search}`);
  return returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
}
