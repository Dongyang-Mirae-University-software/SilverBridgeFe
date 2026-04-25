export type RoleType = 'WARD' | 'GUARDIAN';
export interface ISignupReq {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: RoleType;
}

export interface IEmailVerityReq {
  email: string;
  code: string;
}

export interface IFindEmailResponse {
  maskedEmail: string | null;
  hasKakaoAccount: boolean;
}

export interface IFindEmailReq {
  name: string;
  phone: string;
}

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

export interface IPasswordResetReq {
  token: string;
  newPassword: string;
}

export interface IFindPasswordTokenResponse {
  token: string;
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
  }
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
  }
}
