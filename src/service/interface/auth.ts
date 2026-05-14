export type RoleType = 'WARD' | 'GUARDIAN';

// ── 인증 ──────────────────────────────────────────────────────────────────────
export interface ISigninReq {
  email: string;
  password: string;
}

export interface IKakaoSigninReq {
  code: string;
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
    refreshToken?: string;
    userId?: string;
    role?: string;
    newUser: boolean;
  };
}

// ── 회원가입 ──────────────────────────────────────────────────────────────────
export interface ISignupReq {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: RoleType;
}

export interface IKakaoSignupReq {
  kakaoId: string;
  name: string;
  phone: string;
  role: RoleType;
  profileImageUrl?: string;
  address: string;
  addressDetail: string;
}

export interface IKakaoSignupRes {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
    name: string;
    role: string;
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
  token: string;
}

export interface IFindPasswordSmsSendReq {
  name: string;
  phone: string;
}

export interface IFindPasswordSmsVerifyReq {
  phone: string;
  code: string;
}

export interface IFindPasswordTokenResponse {
  token: string;
}

// ── 비밀번호 재설정 ────────────────────────────────────────────────────────────
export interface IPasswordResetReq {
  token: string;
  newPassword: string;
}
