import axios from 'axios';
import { IEmailVerityReq, IFindEmailResponse, ISignupReq } from '../interface/auth';
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

//
export async function emailVerify(body: IEmailVerityReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/verify`, body);
}

export async function emailCheck(body: { email: string }) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/email/check`, body);
}

export async function smsVerify(body: { phone: string; code: string }) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/sms/verify`, body);
}

export async function smsSend(body: { phone: string }) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/sms/send`, body);
}

// login
export async function login(body: { email: string; password: string }) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/login`, body);
}

// login
export async function findEmail(body: { name: string; phone: string }) {
  return apiClient.post<CommonResponse<IFindEmailResponse>>(`${AUTH_API_PATH}/find-email`, body);
}
