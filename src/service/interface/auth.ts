export type RoleType = 'WARD' | 'GUARDIAN';
export type GenderType = 'MALE' | 'FEMALE';

export interface IAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
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
    role?: RoleType;
    isNewUser?: boolean;
    newUser?: boolean;
  };
}

export interface IRefreshReq {
  refreshToken: string;
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
