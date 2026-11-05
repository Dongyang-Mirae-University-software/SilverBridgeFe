// 피보호자(WARD)의 안부 말벗 API
// Swagger 그룹: "피보호자 - 안부 말벗" (/api/ward/companion/**) - 사용자는 토큰으로만 정해진다

import { apiClient } from '@/lib/api/apiClient';
import { getResponseData } from '@/utils/api/responseData';
import { CommonResponse } from '../../interface/common';
import {
  IWardCompanionFinish,
  IWardCompanionReply,
  IWardCompanionSession,
  IWardCompanionToday,
} from '../../interface/ward/companion';

const WARD_BASE = '/ward/companion';

// 말벗이 한 턴에 최대 90초 걸린다(504 COMPANION_TIMEOUT) - 서버보다 먼저 끊지 않게 100초 넘게 기다린다
export const COMPANION_TIMEOUT_MS = 100_000;

// 오늘 5개 시간대 상태와 지금 열 수 있는 시간대
export async function getWardCompanionToday() {
  const response = await apiClient.get<CommonResponse<IWardCompanionToday>>(`${WARD_BASE}/today`);
  return getResponseData<IWardCompanionToday>(response);
}

// 지금 시간대 대화를 연다. 이미 열려 있으면 그 대화를 돌려준다(resumed=true)
export async function openWardCompanionSession() {
  const response = await apiClient.post<CommonResponse<IWardCompanionSession>>(`${WARD_BASE}/sessions`, undefined, {
    timeout: COMPANION_TIMEOUT_MS,
  });
  return getResponseData<IWardCompanionSession>(response);
}

// 글로 대답(1~500자)
export async function replyWardCompanionText(sessionId: number, text: string) {
  const response = await apiClient.post<CommonResponse<IWardCompanionReply>>(
    `${WARD_BASE}/sessions/${sessionId}/reply`,
    { text },
    { timeout: COMPANION_TIMEOUT_MS },
  );
  return getResponseData<IWardCompanionReply>(response);
}

// 음성으로 대답 - WAV 1개(5MB 이하). 표정 참고용 frame은 보내지 않는다(선택 항목, 카메라 권한을 따로 묻지 않는다)
// Content-Type을 'multipart/form-data'로 덮어 두면 axios가 지우고 브라우저가 boundary를 붙인다(chatStt.ts와 같은 방식)
export async function replyWardCompanionAudio(sessionId: number, audio: Blob, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append('audio', audio, 'voice.wav');
  const response = await apiClient.post<CommonResponse<IWardCompanionReply>>(
    `${WARD_BASE}/sessions/${sessionId}/reply/audio`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: COMPANION_TIMEOUT_MS, signal },
  );
  return getResponseData<IWardCompanionReply>(response);
}

// 대화 마치기 - 이미 마친 대화에 다시 불러도 저장된 결과를 그대로 돌려준다
export async function finishWardCompanionSession(sessionId: number) {
  const response = await apiClient.post<CommonResponse<IWardCompanionFinish>>(
    `${WARD_BASE}/sessions/${sessionId}/finish`,
    undefined,
    { timeout: COMPANION_TIMEOUT_MS },
  );
  return getResponseData<IWardCompanionFinish>(response);
}
