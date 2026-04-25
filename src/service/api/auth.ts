import axios from 'axios';
import { IEmailVerityReq, IFindEmailReq, IFindEmailResponse, IFindPasswordEmailSendReq, IFindPasswordEmailVerifyReq, IFindPasswordSmsSendReq, IFindPasswordSmsVerifyReq, IPasswordResetReq, IFindPasswordTokenResponse, ISignupReq } from '../interface/auth';
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

// find-email
export async function findEmail(body: IFindEmailReq) {
  return apiClient.post<CommonResponse<IFindEmailResponse>>(`${AUTH_API_PATH}/find-email`, body);
}

// find-password email
export async function findPasswordEmailSend(body: IFindPasswordEmailSendReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/find-password/email/send`, body);
}

export async function findPasswordEmailVerify(body: IFindPasswordEmailVerifyReq) {
  return apiClient.post<CommonResponse<IFindPasswordTokenResponse>>(`${AUTH_API_PATH}/find-password/email/verify`, body);
}

export async function findPasswordEmailResend(body: IFindPasswordEmailSendReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/find-password/email/resend`, body);
}

// find-password sms
export async function findPasswordSmsSend(body: IFindPasswordSmsSendReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/find-password/sms/send`, body);
}

export async function findPasswordSmsVerify(body: IFindPasswordSmsVerifyReq) {
  return apiClient.post<CommonResponse<IFindPasswordTokenResponse>>(`${AUTH_API_PATH}/find-password/sms/verify`, body);
}

export async function findPasswordSmsResend(body: IFindPasswordSmsSendReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/find-password/sms/resend`, body);
}

// password reset
export async function passwordReset(body: IPasswordResetReq) {
  return apiClient.post<CommonResponse<null>>(`${AUTH_API_PATH}/password/reset`, body);
}
