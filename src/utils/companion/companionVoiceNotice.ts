import { STT_MESSAGES } from '@/service/api/chatSttPolicy';

// 음성 입력 공용 안내(STT_MESSAGES)는 AI 의료 챗봇 기준이라 "글로 입력해 주세요"를 붙인다 - 챗봇에는 글 칸이 있다.
// 안부 말벗은 목소리로만 대답하므로(2026-11-23 #331 사용자 결정) 말벗 화면에서는 아래 문구로 바꿔 보인다.
// 공용 문구를 고치지 말 것 - 챗봇 화면·테스트가 그대로 쓴다(2026-11-23 FE 디자인 점검 D-1, 사용자 결정 "안내만 바꾸기").
export const COMPANION_VOICE_NOTICE = {
  // 피보호자 기기는 주로 태블릿이라 "기기 설정"(2026-11-23 #335 점검 V-2 사용자 결정)
  permission: '마이크를 쓸 수 있게 허용해 주셔야 말벗과 이야기할 수 있어요. 기기 설정에서 마이크를 켜 주세요.',
  // 장치 없음·다른 앱이 사용 중은 권한을 켜도 풀리지 않는다(V-1, 짧은 문구 - 사용자 결정)
  micNotFound: '마이크를 찾지 못했어요.',
  micInUse: '다른 앱이 마이크를 쓰고 있어요.',
  micOpenFailed: '마이크를 켜지 못했어요.',
  unsupported: '이 기기에서는 말벗과 목소리로 이야기할 수 없어요.',
  unavailable: '지금은 말벗과 이야기할 수 없어요. 잠시 후 다시 해 주세요.',
} as const;

// permission·device: 권한을 켜거나 마이크를 고치면 다시 말할 수 있다(말하기 버튼을 남긴다)
// unsupported: 이 기기에서는 다시 눌러도 소용없다(말하기 버튼을 숨긴다)
// 모두 막다른 화면이 되지 않게 [홈으로]를 함께 보인다
export type CompanionVoiceBlock = 'permission' | 'device' | 'unsupported' | null;

export function companionVoiceNotice(notice: string | null | undefined): { message: string | null; block: CompanionVoiceBlock } {
  if (!notice) return { message: null, block: null };
  if (notice === STT_MESSAGES.permission) return { message: COMPANION_VOICE_NOTICE.permission, block: 'permission' };
  if (notice === STT_MESSAGES.micNotFound) return { message: COMPANION_VOICE_NOTICE.micNotFound, block: 'device' };
  if (notice === STT_MESSAGES.micInUse) return { message: COMPANION_VOICE_NOTICE.micInUse, block: 'device' };
  if (notice === STT_MESSAGES.micOpenFailed) return { message: COMPANION_VOICE_NOTICE.micOpenFailed, block: 'device' };
  if (notice === STT_MESSAGES.unsupported) return { message: COMPANION_VOICE_NOTICE.unsupported, block: 'unsupported' };
  // 그 밖에 글 칸을 가리키는 공용 문구가 오면(지금 말벗 경로에서는 오지 않는다) 글 칸 없는 말로 바꾼다
  // 공용 문구가 새로 늘어 "글로 입력"을 붙여도 말벗에 새지 않게 같은 말로 바꾼다(2026-11-23 #335 점검 V-3, 가드 테스트가 고정)
  if (notice === STT_MESSAGES.unavailable || notice === STT_MESSAGES.disabled || notice.includes('글로')) {
    return { message: COMPANION_VOICE_NOTICE.unavailable, block: null };
  }
  return { message: notice, block: null };
}
