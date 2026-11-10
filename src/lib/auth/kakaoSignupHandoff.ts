// 카카오 로그인(신규 회원) → 가입 화면으로 넘기는 정보. 주소(쿼리)에 싣지 않고 이 탭의 sessionStorage 에만 둔다 -
// 주소에 실으면 카카오 ID·이메일이 방문 기록·서버 접근 로그에 남는다(2026-11-10 전체 점검 S-6).
// pendingToken 은 가입 완료(POST /api/auth/signup/kakao) 때 그대로 돌려보내야 하는 일회용 값이다(서버 유지 30분).
export type KakaoSignupHandoff = {
  kakaoId: string;
  email: string;
  profileImageUrl?: string;
  pendingToken: string;
};

const STORAGE_KEY = 'careai_kakao_signup';
const MAX_AGE_MS = 30 * 60 * 1000;

function getStorage() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveKakaoSignupHandoff(data: KakaoSignupHandoff, now = Date.now()) {
  getStorage()?.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: now }));
}

export function clearKakaoSignupHandoff() {
  getStorage()?.removeItem(STORAGE_KEY);
}

// 없거나 형식이 틀리거나 30분이 지났으면 null(지운다)
export function readKakaoSignupHandoff(now = Date.now()): KakaoSignupHandoff | null {
  const raw = getStorage()?.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<KakaoSignupHandoff> & { savedAt?: number };
    const fresh = typeof parsed.savedAt === 'number' && now - parsed.savedAt < MAX_AGE_MS;
    if (fresh && parsed.kakaoId && parsed.email && parsed.pendingToken) {
      return {
        kakaoId: parsed.kakaoId,
        email: parsed.email,
        profileImageUrl: parsed.profileImageUrl || undefined,
        pendingToken: parsed.pendingToken,
      };
    }
  } catch {
    // 아래에서 지운다
  }

  clearKakaoSignupHandoff();
  return null;
}
