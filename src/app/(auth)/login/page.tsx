import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import LoginContent from './_components/LoginContent';
import LoginSessionGate from './_components/LoginSessionGate';
import { resolveEntry } from '@/lib/auth/sessionEntry';
import { getSafeReturnPath } from '@/lib/auth/returnPath';

const ACCESS_TOKEN_KEY = 'careai_access_token';
const REFRESH_TOKEN_KEY = 'careai_refresh_token';

type LoginPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

// 이미 로그인한 사람은 폼 대신 가려던 곳·역할 홈으로 보낸다. 판단은 첫 화면(/)과 같은 resolveEntry.
// access 가 살아 있으면 서버에서 바로 보내 폼이 깜빡이지 않게 하고, refresh 만 있으면 브라우저에서 갱신한다
// (탭 간 직렬화·회전 토큰 저장이 브라우저 refreshAccessToken 한 곳에 있다)
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const entry = resolveEntry(cookieStore.get(ACCESS_TOKEN_KEY)?.value, cookieStore.get(REFRESH_TOKEN_KEY)?.value);
  const returnTo = getSafeReturnPath((await searchParams).returnTo);

  if (entry.kind === 'redirect' && entry.path !== '/login') redirect(returnTo ?? entry.path);

  return (
    <LoginSessionGate restore={entry.kind === 'restore'} returnTo={returnTo}>
      <LoginContent />
    </LoginSessionGate>
  );
}
