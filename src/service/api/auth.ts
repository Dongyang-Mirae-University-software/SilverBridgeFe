import axios from 'axios';
import { IEmailVerityReq, ISignupReq } from '../interface/auth';
import { CommonResponse } from '../interface/common';

const AUTH_API_PATH = '/api/auth';

export async function signup(body: ISignupReq) {
  const res = await axios.post<CommonResponse<null>>(`${AUTH_API_PATH}/register`, body).then(res => res.data);

  return res.data;
}

export async function eamaillSend(body: { email: string }) {
  const res = await axios.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/send`, body).then(res => res.data);

  return res.data;
}

export async function emailVerify(body: IEmailVerityReq) {
  const res = await axios.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/verify`, body).then(res => res.data);

  return res.data;
}
