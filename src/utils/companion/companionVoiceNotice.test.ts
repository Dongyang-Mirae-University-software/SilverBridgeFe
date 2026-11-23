import { describe, expect, it } from 'vitest';

import { STT_MESSAGES } from '@/service/api/chatSttPolicy';
import { COMPANION_VOICE_NOTICE, companionVoiceNotice } from './companionVoiceNotice';

describe('말벗 음성 안내 (FE 디자인 점검 D-1)', () => {
  it('마이크 권한 거부는 말벗 문구 + 말하기 버튼 유지(permission)', () => {
    expect(companionVoiceNotice(STT_MESSAGES.permission)).toEqual({ message: COMPANION_VOICE_NOTICE.permission, block: 'permission' });
  });

  it('음성 미지원은 말벗 문구 + 말하기 버튼 숨김(unsupported)', () => {
    expect(companionVoiceNotice(STT_MESSAGES.unsupported)).toEqual({ message: COMPANION_VOICE_NOTICE.unsupported, block: 'unsupported' });
  });

  it.each([STT_MESSAGES.unavailable, STT_MESSAGES.disabled])('글 칸을 가리키는 공용 문구는 글 칸 없는 말로 바꾼다: %s', notice => {
    expect(companionVoiceNotice(notice)).toEqual({ message: COMPANION_VOICE_NOTICE.unavailable, block: null });
  });

  it('말벗 문구에는 "글로 입력"이 없다', () => {
    Object.values(COMPANION_VOICE_NOTICE).forEach(text => expect(text).not.toContain('글로'));
  });

  it('그 밖의 안내는 그대로, 없으면 없음', () => {
    expect(companionVoiceNotice(STT_MESSAGES.empty)).toEqual({ message: STT_MESSAGES.empty, block: null });
    expect(companionVoiceNotice(null)).toEqual({ message: null, block: null });
    expect(companionVoiceNotice('')).toEqual({ message: null, block: null });
  });

  it('공용 문구(챗봇용)는 그대로 "글로 입력해 주세요"를 쓴다 - 챗봇에는 글 칸이 있다', () => {
    expect(STT_MESSAGES.unsupported).toContain('글로 입력해 주세요');
  });
});
