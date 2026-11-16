// 로그아웃의 마지막 화면 이동을 반드시 끝낸다.
// 재배포 전에 열어 둔 화면은 예전 코드를 쥐고 있어 router.replace('/login')가 조용히 실패할 수 있다(2026-11-13 핸드폰 보호자).
// 화면 안 이동을 먼저 하고, 잠시 뒤에도 /login이 아니면 페이지를 새로 연다. 새로 열면 진행 중인 요청이 끊기므로
// 그 전에 서버 로그아웃을 조금 더 기다린다 - 빠지면 refresh 쿠키(careai_rt)가 7일 남는다.
export const LOGOUT_NAV_GRACE_MS = 1500;
export const LOGOUT_SESSION_WAIT_MS = 1500;

const LOGIN_PATH = '/login';

interface LogoutNavigationDeps {
  getPath: () => string;
  hardReplace: (path: string) => void;
  wait: (ms: number) => Promise<void>;
}

const browserDeps: LogoutNavigationDeps = {
  getPath: () => window.location.pathname,
  hardReplace: path => window.location.replace(path),
  wait: ms => new Promise(resolve => window.setTimeout(resolve, ms)),
};

export async function ensureLoggedOutPage(session: Promise<unknown>, deps: LogoutNavigationDeps = browserDeps) {
  await deps.wait(LOGOUT_NAV_GRACE_MS);
  if (deps.getPath() === LOGIN_PATH) return;
  await Promise.race([session.catch(() => undefined), deps.wait(LOGOUT_SESSION_WAIT_MS)]);
  if (deps.getPath() !== LOGIN_PATH) deps.hardReplace(LOGIN_PATH);
}
