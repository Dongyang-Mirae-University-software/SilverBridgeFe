import { registerFcmTokenForCurrentDevice } from '@/lib/fcm';
import { AuthRole, setAuthTokens } from './tokenStore';

export function completeSigninSession(tokens: { accessToken: string; refreshToken: string; role?: AuthRole }) {
  setAuthTokens(tokens);

  void registerFcmTokenForCurrentDevice().catch(error => {
    console.error('FCM 토큰 등록 실패:', error);
  });
}
