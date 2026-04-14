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

export interface IFindEmailVerifyReq extends IFindEmailReq {
  code: string;
}
