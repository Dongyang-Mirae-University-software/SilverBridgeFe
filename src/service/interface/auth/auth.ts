export type RoleType = 'WARD' | 'GUARDIAN' | 'ADMIN';
export type GenderType = 'MALE' | 'FEMALE';

// refreshToken 은 백엔드 전환 기간(body-compat) 동안만 본문에 실려 온다. 화면은 읽지도 저장하지도 않는다 -
// refresh 토큰은 HttpOnly 쿠키(careai_rt)로만 오간다
export interface IAuthTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
}

export interface ISigninResponse extends IAuthTokenResponse {
  userId: string;
  email: string;
  name: string;
  role: RoleType;
}

// ── 인증 ──────────────────────────────────────────────────────────────────────
export interface ISigninReq {
  email: string;
  password: string;
}

export interface IKakaoSigninReq {
  code: string;
  redirectUri: string;
}

export interface IKakaoSigninRes {
  success: boolean;
  message: string;
  data: {
    kakaoId?: string;
    email?: string;
    name?: string;
    profileImageUrl?: string;
    accessToken?: string;
    // 신규 회원에게만 온다. 가입 완료(POST /api/auth/signup/kakao) 때 그대로 돌려보내야 한다(없으면 400)
    pendingToken?: string;
    userId?: string;
    role?: RoleType;
    isNewUser?: boolean;
    newUser?: boolean;
  };
}

// ── 회원가입 ──────────────────────────────────────────────────────────────────
export interface ISignupReq {
  name: string;
  email: string;
  password: string;
  phone: string;
  verificationNonce: string;
  role: RoleType;
  address: string;
  addressDetail: string;
  gender: GenderType;
  birthDate: string;
  postcode: string;
}

export interface ISmsVerifyResponse {
  verificationNonce: string;
}

export interface IKakaoSignupReq {
  kakaoId: string;
  // 카카오 로그인 응답(신규 회원)에서 받은 값 - 로그인을 시작한 본인만 가입을 끝낼 수 있게 한다
  pendingToken: string;
  name: string;
  phone: string;
  verificationNonce: string;
  role: RoleType;
  profileImageUrl?: string;
  address: string;
  addressDetail: string;
  gender: GenderType;
  birthDate: string;
  postcode: string;
}

export interface IKakaoSignupRes {
  success: boolean;
  message: string;
  data: IAuthTokenResponse & {
    userId: string;
    email: string;
    name: string;
    role: RoleType;
  };
}

// ── 아이디(이메일) 찾기 ────────────────────────────────────────────────────────
export interface IFindEmailReq {
  name: string;
  phone: string;
}

export interface IFindEmailResponse {
  maskedEmail: string | null;
  hasKakaoAccount: boolean;
  createdAt?: string | null;
}

// ── 비밀번호 찾기 ─────────────────────────────────────────────────────────────
export interface IFindPasswordEmailSendReq {
  email: string;
}

export interface IFindPasswordEmailVerifyReq {
  email: string;
  code: string;
}

export interface IFindPasswordSmsSendReq {
  name: string;
  phone: string;
}

export interface IFindPasswordSmsVerifyReq {
  phone: string;
  code: string;
}

export interface IFindPasswordSendResponse {
  expiresInSeconds: number;
  codeLength: number;
}

// ── 비밀번호 재설정 ────────────────────────────────────────────────────────────
export type IPasswordResetReq =
  | {
      email: string;
      code: string;
      newPassword: string;
    }
  | {
      phone: string;
      code: string;
      newPassword: string;
    };
