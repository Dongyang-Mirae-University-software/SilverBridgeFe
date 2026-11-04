// 회원가입 단계. 한 화면에 칸을 4개 안팎만 두어 스크롤 없이 보이게 나눈다.
// 카카오 가입은 이메일이 채워져 오고 비밀번호가 없어 '계정' 단계를 건너뛴다(가입 유형은 '내 정보'에서 고른다)
export type SignupStepKey = 'account' | 'profile' | 'phone';

export const SIGNUP_STEP_LABEL: Record<SignupStepKey, string> = {
  account: '계정',
  profile: '내 정보',
  phone: '전화번호 인증',
};

export function getSignupSteps(isKakao: boolean): SignupStepKey[] {
  return isKakao ? ['profile', 'phone'] : ['account', 'profile', 'phone'];
}
