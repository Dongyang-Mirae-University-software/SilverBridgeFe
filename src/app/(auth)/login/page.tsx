import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import LoginContent from './_components/LoginContent';
import { getRoleFromAccessToken } from '@/lib/auth/sessionEntry';
import { getSafeReturnPath } from '@/lib/auth/returnPath';
import { getRoleHomePath } from '@/utils/auth/routes';

const ACCESS_TOKEN_KEY = 'careai_access_token';

type LoginPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

// 이미 로그인돼 있으면(만료 전 access 토큰) 로그인 화면 대신 가려던 곳·역할 홈으로 보낸다.
// 토큰이 서버에서 거절되면 역할 가드가 세션을 지우고 다시 이곳으로 보내므로 되돌이 이동은 생기지 않는다
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const role = getRoleFromAccessToken(cookieStore.get(ACCESS_TOKEN_KEY)?.value);

  if (role) {
    const { returnTo } = await searchParams;
    redirect(getSafeReturnPath(returnTo) ?? getRoleHomePath(role));
  }

  return <LoginContent />;
}
