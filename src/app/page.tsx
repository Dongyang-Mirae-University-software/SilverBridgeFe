import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import SessionRestore from '@/components/auth/SessionRestore';
import { resolveEntry } from '@/lib/auth/sessionEntry';

const ACCESS_TOKEN_KEY = 'careai_access_token';
// 로그인 세션 표시(토큰 아님). 예전 버전이 남긴 refresh 쿠키만 있는 사람도 브라우저에서 갱신해 보게 한다
const SESSION_KEY = 'careai_session';
const LEGACY_REFRESH_TOKEN_KEY = 'careai_refresh_token';

export default async function Home() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.get(SESSION_KEY)?.value === '1' || cookieStore.get(LEGACY_REFRESH_TOKEN_KEY) !== undefined;
  const entry = resolveEntry(cookieStore.get(ACCESS_TOKEN_KEY)?.value, hasSession);

  if (entry.kind === 'restore') return <SessionRestore />;

  redirect(entry.path);
}
