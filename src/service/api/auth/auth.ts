// 인증 관련 API: 로그인/회원가입/카카오/SMS 인증/비밀번호·이메일 찾기/로그아웃/토큰 재발급
// Swagger 그룹: "공통 - 인증" (/api/auth/**)
// signin/signup 계열은 토큰 없이 호출 가능, logout/refresh는 토큰 필요

import { apiClient, sendWithEndedSession } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import {
  IFindEmailReq,
  IFindEmailResponse,
  IFindPasswordEmailSendReq,
  IFindPasswordEmailVerifyReq,
  IFindPasswordSmsSendReq,
  IFindPasswordSmsVerifyReq,
  IFindPasswordSendResponse,
  ISmsVerifyResponse,
  IKakaoSigninReq,
  IKakaoSigninRes,
  IKakaoSignupReq,
  IKakaoSignupRes,
  IPasswordResetReq,
  ISigninReq,
  ISigninResponse,
  ISignupReq,
} from '../../interface/auth/auth';

const BASE = '/auth';

// ── 인증 ──────────────────────────────────────────────────────────────────────
export async function signin(body: ISigninReq) {
  return apiClient.post<CommonResponse<ISigninResponse>>(`${BASE}/signin`, body);
}

export async function signinKakao(body: IKakaoSigninReq) {
  return apiClient.post<CommonResponse<IKakaoSigninRes['data']>>(`${BASE}/signin/kakao`, body);
}

// 로그아웃은 이 기기의 세션을 먼저 지운 뒤 보낸다 - 지우기 전에 꺼내 둔 access 토큰을 받는다
export async function logout(accessToken: string) {
  return sendWithEndedSession<CommonResponse<null>>(accessToken, { method: 'post', url: `${BASE}/logout` });
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
  return apiClient.post<CommonResponse<ISmsVerifyResponse>>(`${BASE}/signup/sms/verify`, body);
}

export async function signupSmsResend(body: { phone: string }) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/signup/sms/resend`, body);
}

// ── 아이디(이메일) 찾기 ────────────────────────────────────────────────────────
export async function findEmail(body: IFindEmailReq) {
  return apiClient.post<CommonResponse<IFindEmailResponse>>(`${BASE}/find-email`, body);
}

// ── 비밀번호 찾기 · 이메일 ───────────────────────────────────────────────────
// 메일 발송은 10초(기본 대기)를 넘길 수 있다 - 서버는 보냈는데 화면만 실패로 끊지 않게 넉넉히 기다린다(QA AUTH-A36)
const EMAIL_SEND_TIMEOUT_MS = 30_000;

export async function findPasswordEmailSend(body: IFindPasswordEmailSendReq) {
  return apiClient.post<CommonResponse<IFindPasswordSendResponse>>(`${BASE}/find-password/email/send`, body, {
    timeout: EMAIL_SEND_TIMEOUT_MS,
  });
}

export async function findPasswordEmailVerify(body: IFindPasswordEmailVerifyReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/find-password/email/verify`, body);
}

export async function findPasswordEmailResend(body: IFindPasswordEmailSendReq) {
  return apiClient.post<CommonResponse<IFindPasswordSendResponse>>(`${BASE}/find-password/email/resend`, body, {
    timeout: EMAIL_SEND_TIMEOUT_MS,
  });
}

// ── 비밀번호 찾기 · SMS ──────────────────────────────────────────────────────
export async function findPasswordSmsSend(body: IFindPasswordSmsSendReq) {
  return apiClient.post<CommonResponse<IFindPasswordSendResponse>>(`${BASE}/find-password/sms/send`, body);
}

export async function findPasswordSmsVerify(body: IFindPasswordSmsVerifyReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/find-password/sms/verify`, body);
}

export async function findPasswordSmsResend(body: IFindPasswordSmsSendReq) {
  return apiClient.post<CommonResponse<IFindPasswordSendResponse>>(`${BASE}/find-password/sms/resend`, body);
}

// ── 비밀번호 재설정 ────────────────────────────────────────────────────────────
export async function passwordReset(body: IPasswordResetReq) {
  return apiClient.post<CommonResponse<null>>(`${BASE}/password/reset`, body);
}
