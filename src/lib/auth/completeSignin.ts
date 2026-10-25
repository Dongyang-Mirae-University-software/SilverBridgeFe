import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import { reportNonApiError } from '@/lib/api/reportError';
import { AuthRole, setAuthTokens } from './tokenStore';

// remember: "로그인 유지" 체크 여부. 체크박스가 없는 카카오 로그인·회원가입 완료는 유지로 본다
export function completeSigninSession(tokens: { accessToken: string; refreshToken: string; role?: AuthRole; remember?: boolean }) {
  setAuthTokens({ ...tokens, remember: tokens.remember ?? true });

  void registerFcmTokenForCurrentDevice().catch(error => {
    reportNonApiError('FCM 토큰 등록 실패:', error);
  });
}
