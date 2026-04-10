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
