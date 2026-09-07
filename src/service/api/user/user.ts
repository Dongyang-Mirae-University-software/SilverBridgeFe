// 내 계정(프로필) 관련 API: 조회/수정/탈퇴/비밀번호 변경/프로필 이미지
// Swagger 그룹: "공통 - 내 계정" (/api/user/me/**)
// 피보호자·보호자·관리자가 모두 같은 경로를 씀 (역할별로 나뉘지 않음)

import { apiClient } from '@/lib/api/apiClient';
import { CommonResponse } from '../../interface/common';
import { IUserDeleteReq, IUserPasswordChangeReq, IUserProfile, IUserUpdateReq } from '../../interface/user/user';

const BASE = '/user';

// 내 정보 조회
export async function getMyProfile() {
  return apiClient.get<CommonResponse<IUserProfile>>(`${BASE}/me`);
}

// 내 정보 수정
export async function updateMyProfile(body: IUserUpdateReq) {
  return apiClient.put<CommonResponse<IUserProfile>>(`${BASE}/me`, body);
}

// 비밀번호 변경 (로그인 상태)
export async function changeMyPassword(body: IUserPasswordChangeReq) {
  return apiClient.put<CommonResponse<null>>(`${BASE}/me/password`, body);
}

// 프로필 이미지 변경
export async function changeMyProfileImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.patch<CommonResponse<IUserProfile>>(`${BASE}/me/image`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

// 프로필 이미지 삭제
export async function deleteMyProfileImage() {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/me/image`);
}

// 회원 탈퇴
export async function deleteMyAccount(body: IUserDeleteReq) {
  return apiClient.delete<CommonResponse<null>>(`${BASE}/me`, {
    data: body,
  });
}
