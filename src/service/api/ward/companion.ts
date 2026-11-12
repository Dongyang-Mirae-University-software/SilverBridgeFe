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
  IWardCompanionTranscriptConsent,
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

// [테스트 계정만] 고른 시간대의 고정 질문으로 대화를 연다 - 응답은 대화 열기와 같다. 아니면 403 COMPANION_TEST_NOT_ALLOWED
export async function openWardCompanionTestSession(slot: string) {
  const response = await apiClient.post<CommonResponse<IWardCompanionSession>>(`${WARD_BASE}/test/sessions`, { slot }, {
    timeout: COMPANION_TIMEOUT_MS,
  });
  return getResponseData<IWardCompanionSession>(response);
}

// [테스트 계정만] 고른 시간대의 안부 안내 푸시를 나에게 보낸다(204). 푸시 data는 정각 안내와 같고 test=true가 붙는다
export async function sendWardCompanionTestPrompt(slot: string) {
  await apiClient.post(`${WARD_BASE}/test/prompt`, { slot });
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

// 음성으로 대답 - WAV 1개(5MB 이하) + 표정 참고용 frame(JPEG 장당 1MB 이하, 최대 5장, 같은 이름으로 여러 번). 합계 10MB 안
// 카메라를 못 쓰면 frames 없이 audio만 보낸다. 사진은 보내고 나면 버린다(저장하지 않음)
// Content-Type을 'multipart/form-data'로 덮어 두면 axios가 지우고 브라우저가 boundary를 붙인다(chatStt.ts와 같은 방식)
export async function replyWardCompanionAudio(sessionId: number, audio: Blob, signal?: AbortSignal, frames: Blob[] = []) {
  const formData = new FormData();
  formData.append('audio', audio, 'voice.wav');
  frames.forEach((frame, index) => formData.append('frame', frame, `frame${index + 1}.jpg`));
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

// 대화 내용 가족 공유 동의 상태
export async function getWardCompanionTranscriptConsent() {
  const response = await apiClient.get<CommonResponse<IWardCompanionTranscriptConsent>>(`${WARD_BASE}/transcript-consent`);
  return getResponseData<IWardCompanionTranscriptConsent>(response);
}

// 동의(true)·철회(false). 철회하면 서버가 저장된 대화 내용을 바로 지운다
export async function updateWardCompanionTranscriptConsent(consent: boolean) {
  const response = await apiClient.put<CommonResponse<IWardCompanionTranscriptConsent>>(`${WARD_BASE}/transcript-consent`, { consent });
  return getResponseData<IWardCompanionTranscriptConsent>(response);
}
