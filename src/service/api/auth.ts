import axios from 'axios';
import { IEmailVerityReq, ISignupReq } from '../interface/auth';
import { CommonResponse } from '../interface/common';
import { apiClient } from '@/lib/api/apiClient';

const AUTH_API_PATH = '/api/auth';

export async function signup(body: ISignupReq) {
  const res = await axios.post<CommonResponse<null>>(`${AUTH_API_PATH}/register`, body);

  return res.data;
}

export async function eamaillSend(body: { email: string }) {
  const res = await axios.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/send`, body);

  return res.data;
}

export async function emailVerify(body: IEmailVerityReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/verify`, body);
}

export async function emailCheck(body: { email: string }) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/check`, body);
}
