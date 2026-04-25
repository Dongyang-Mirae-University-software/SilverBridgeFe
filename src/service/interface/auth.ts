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
