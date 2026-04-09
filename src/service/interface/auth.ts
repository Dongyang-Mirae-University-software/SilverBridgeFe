export interface ISignupReq {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: 'WARD' | '';
}

export interface IEmailVerityReq {
  email: string;
  code: string;
}
