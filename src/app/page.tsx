import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import SessionRestore from '@/components/auth/SessionRestore';
import { resolveEntry } from '@/lib/auth/sessionEntry';

const ACCESS_TOKEN_KEY = 'careai_access_token';
const REFRESH_TOKEN_KEY = 'careai_refresh_token';

export default async function Home() {
  const cookieStore = await cookies();
  const entry = resolveEntry(cookieStore.get(ACCESS_TOKEN_KEY)?.value, cookieStore.get(REFRESH_TOKEN_KEY)?.value);

  if (entry.kind === 'restore') return <SessionRestore />;

  redirect(entry.path);
}
