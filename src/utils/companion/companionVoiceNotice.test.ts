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

  // 2026-11-23 FE #335 점검 V-1·V-2·V-3
  it.each([
    [STT_MESSAGES.micNotFound, COMPANION_VOICE_NOTICE.micNotFound],
    [STT_MESSAGES.micInUse, COMPANION_VOICE_NOTICE.micInUse],
    // 2026-11-24 #337 점검 K-2 - 원인을 모르는 장치 시작 실패
    [STT_MESSAGES.micOpenFailed, COMPANION_VOICE_NOTICE.micOpenFailed],
  ])('마이크 장치 없음·사용 중·켜기 실패는 말벗 짧은 문구 + 말하기 버튼 유지(device): %s', (notice, message) => {
    expect(companionVoiceNotice(notice)).toEqual({ message, block: 'device' });
  });

  it('권한 문구는 "기기 설정"이다(피보호자 기기는 주로 태블릿)', () => {
    expect(COMPANION_VOICE_NOTICE.permission).toContain('기기 설정에서');
    expect(COMPANION_VOICE_NOTICE.permission).not.toContain('휴대폰');
  });

  it('공용 문구가 새로 늘어 "글로 입력"을 붙여도(아직 없는 문구) 말벗에는 글 칸 없는 말로 보인다', () => {
    expect(companionVoiceNotice('새로 생긴 안내예요. 글로 입력해 주세요.')).toEqual({ message: COMPANION_VOICE_NOTICE.unavailable, block: null });
  });

  it('가드: 공용 음성 안내 어느 것이 와도 말벗 화면에는 "글로"가 나오지 않는다 - 공용 문구가 늘어도 새지 않게', () => {
    Object.values(STT_MESSAGES).forEach(notice => {
      expect(companionVoiceNotice(notice).message ?? '').not.toContain('글로');
    });
  });
});
