export interface ISignupReq {
  name: string;
  email: string;
  password: string;
  phone: string;
  // TODO: 추후 타입 수정 'WARD' | '';
  role: string;
}
