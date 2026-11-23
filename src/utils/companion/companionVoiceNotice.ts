import { STT_MESSAGES } from '@/service/api/chatSttPolicy';

// 음성 입력 공용 안내(STT_MESSAGES)는 AI 의료 챗봇 기준이라 "글로 입력해 주세요"를 붙인다 - 챗봇에는 글 칸이 있다.
// 안부 말벗은 목소리로만 대답하므로(2026-11-23 #331 사용자 결정) 말벗 화면에서는 아래 문구로 바꿔 보인다.
// 공용 문구를 고치지 말 것 - 챗봇 화면·테스트가 그대로 쓴다(2026-11-23 FE 디자인 점검 D-1, 사용자 결정 "안내만 바꾸기").
export const COMPANION_VOICE_NOTICE = {
  permission: '마이크를 쓸 수 있게 허용해 주셔야 말벗과 이야기할 수 있어요. 휴대폰 설정에서 마이크를 켜 주세요.',
  unsupported: '이 기기에서는 말벗과 목소리로 이야기할 수 없어요.',
  unavailable: '지금은 말벗과 이야기할 수 없어요. 잠시 후 다시 해 주세요.',
} as const;

// permission: 권한을 켜면 다시 말할 수 있다(말하기 버튼을 남긴다)
// unsupported: 이 기기에서는 다시 눌러도 소용없다(말하기 버튼을 숨긴다)
// 두 경우 모두 막다른 화면이 되지 않게 [홈으로]를 함께 보인다
export type CompanionVoiceBlock = 'permission' | 'unsupported' | null;

export function companionVoiceNotice(notice: string | null | undefined): { message: string | null; block: CompanionVoiceBlock } {
  if (!notice) return { message: null, block: null };
  if (notice === STT_MESSAGES.permission) return { message: COMPANION_VOICE_NOTICE.permission, block: 'permission' };
  if (notice === STT_MESSAGES.unsupported) return { message: COMPANION_VOICE_NOTICE.unsupported, block: 'unsupported' };
  // 그 밖에 글 칸을 가리키는 공용 문구가 오면(지금 말벗 경로에서는 오지 않는다) 글 칸 없는 말로 바꾼다
  if (notice === STT_MESSAGES.unavailable || notice === STT_MESSAGES.disabled) {
    return { message: COMPANION_VOICE_NOTICE.unavailable, block: null };
  }
  return { message: notice, block: null };
}
