import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../interface/common';
import {
  IFindEmailReq,
  IFindEmailResponse,
  IFindPasswordEmailSendReq,
  IFindPasswordEmailVerifyReq,
  IFindPasswordSmsSendReq,
  IFindPasswordSmsVerifyReq,
  IFindPasswordTokenResponse,
  IKakaoSigninReq,
  IKakaoSigninRes,
  IKakaoSignupReq,
  IKakaoSignupRes,
  IPasswordResetReq,
  ISigninReq,
  ISignupReq,
} from '../interface/auth';

const BASE = '/api/auth';

// ── 인증 ──────────────────────────────────────────────────────────────────────
export async function signin(body: ISigninReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signin`, body);
}

export async function signinKakao(body: IKakaoSigninReq) {
  return apiClient.post<CommonResponse<IKakaoSigninRes['data']>>(`${BASE}/signin/kakao`, body);
}

export async function logout() {
  return apiClient.post<CommonResponse<null>>(`${BASE}/logout`);
}

export async function refresh() {
  return apiClient.post<CommonResponse<null>>(`${BASE}/refresh`);
}

// ── 회원가입 ──────────────────────────────────────────────────────────────────
export async function signup(body: ISignupReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signup`, body);
}

export async function signupKakao(body: IKakaoSignupReq) {
  return apiClient.post<CommonResponse<IKakaoSignupRes['data']>>(`${BASE}/signup/kakao`, body);
}

export async function signupEmailCheck(body: { email: string }) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signup/email/check`, body);
}

export async function signupSmsSend(body: { phone: string }) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signup/sms/send`, body);
}

export async function signupSmsVerify(body: { phone: string; code: string }) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signup/sms/verify`, body);
}

export async function signupSmsResend(body: { phone: string }) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signup/sms/resend`, body);
}

// ── 아이디(이메일) 찾기 ────────────────────────────────────────────────────────
export async function findEmail(body: IFindEmailReq) {
  return apiClient.post<CommonResponse<IFindEmailResponse>>(`${BASE}/find-email`, body);
}

// ── 비밀번호 찾기 · 이메일 ───────────────────────────────────────────────────
export async function findPasswordEmailSend(body: IFindPasswordEmailSendReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/find-password/email/send`, body);
}

export async function findPasswordEmailVerify(body: IFindPasswordEmailVerifyReq) {
  return apiClient.post<CommonResponse<IFindPasswordTokenResponse>>(`${BASE}/find-password/email/verify`, body);
}

export async function findPasswordEmailResend(body: IFindPasswordEmailSendReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/find-password/email/resend`, body);
}

// ── 비밀번호 찾기 · SMS ──────────────────────────────────────────────────────
export async function findPasswordSmsSend(body: IFindPasswordSmsSendReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/find-password/sms/send`, body);
}

export async function findPasswordSmsVerify(body: IFindPasswordSmsVerifyReq) {
  return apiClient.post<CommonResponse<IFindPasswordTokenResponse>>(`${BASE}/find-password/sms/verify`, body);
}

export async function findPasswordSmsResend(body: IFindPasswordSmsSendReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/find-password/sms/resend`, body);
}

// ── 비밀번호 재설정 ────────────────────────────────────────────────────────────
export async function passwordReset(body: IPasswordResetReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/password/reset`, body);
}
