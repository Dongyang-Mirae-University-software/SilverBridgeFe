import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import LoginContent from './_components/LoginContent';
import LoginSessionGate from './_components/LoginSessionGate';
import { resolveEntry } from '@/lib/auth/sessionEntry';
import { getSafeReturnPath } from '@/lib/auth/returnPath';

export const metadata: Metadata = { title: '로그인' };

const ACCESS_TOKEN_KEY = 'careai_access_token';
// 로그인 세션 표시(토큰 아님). 예전 버전이 남긴 refresh 쿠키만 있는 사람도 브라우저에서 갱신해 보게 한다
const SESSION_KEY = 'careai_session';
const LEGACY_REFRESH_TOKEN_KEY = 'careai_refresh_token';
const SESSION_ONLY_TRACE_KEY = 'careai_session_trace';

type LoginPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

// 이미 로그인한 사람은 폼 대신 가려던 곳·역할 홈으로 보낸다. 판단은 첫 화면(/)과 같은 resolveEntry.
// access 가 살아 있으면 서버에서 바로 보내 폼이 깜빡이지 않게 하고, 세션 표시만 있으면 브라우저에서 갱신한다
// (탭 간 직렬화·회전 토큰 저장이 브라우저 refreshAccessToken 한 곳에 있다)
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const hasSession = cookieStore.get(SESSION_KEY)?.value === '1' || cookieStore.get(LEGACY_REFRESH_TOKEN_KEY) !== undefined;
  const entry = resolveEntry(cookieStore.get(ACCESS_TOKEN_KEY)?.value, hasSession);
  // "로그인 유지"를 끈 로그인의 흔적만 남았으면 폼을 보이기 전에 서버에 남은 세션을 끝낸다
  const endLeftover = !hasSession && cookieStore.get(SESSION_ONLY_TRACE_KEY)?.value === '1';
  const returnTo = getSafeReturnPath((await searchParams).returnTo);

  if (entry.kind === 'redirect' && entry.path !== '/login') redirect(returnTo ?? entry.path);

  return (
    <LoginSessionGate restore={entry.kind === 'restore'} endLeftover={endLeftover} returnTo={returnTo}>
      <LoginContent />
    </LoginSessionGate>
  );
}
