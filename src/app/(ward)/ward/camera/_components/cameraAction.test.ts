import { describe, expect, it } from 'vitest';

import {
  formatSceneTime,
  getSceneCaption,
  isMobileCameraDevice,
  isSourceFresh,
  shouldRecoverCamera,
  canGoNextStep,
  formatRegisteredDate,
  getFacingLabel,
  getCameraPrimaryAction,
  getCaptureSize,
  getCardStatus,
  getModalTitle,
  isPortraitFrame,
  isThisDeviceConnecting,
  parseStoredFacing,
} from './cameraAction';

describe('getCameraPrimaryAction', () => {
  it('이 기기의 카메라가 없으면 등록', () => {
    expect(getCameraPrimaryAction(undefined)).toEqual({ kind: 'register' });
  });
  it('송출 중이면 화면 보기', () => {
    expect(getCameraPrimaryAction({ status: 'running' })).toMatchObject({ kind: 'view', label: '카메라 화면 보기' });
  });
  it('끊김·오프라인이면 카메라 켜기', () => {
    expect(getCameraPrimaryAction({ status: 'disconnected' })).toMatchObject({ kind: 'turnOn', label: '카메라 켜기' });
    expect(getCameraPrimaryAction({ status: 'offline' })).toMatchObject({ kind: 'turnOn' });
  });
  it('상태를 모르면(null) 켜기로 취급하지 않는다', () => {
    expect(getCameraPrimaryAction({ status: null })).toMatchObject({ kind: 'checking' });
  });
});

describe('getModalTitle', () => {
  it('카메라가 없으면 등록', () => {
    expect(getModalTitle(undefined, false)).toBe('이 기기를 카메라로 등록');
  });
  it('이 탭이 송출 중이면 화면 보기 제목은 방 이름만', () => {
    expect(getModalTitle('거실', true)).toBe('거실 카메라');
    expect(getModalTitle('거실', false)).toBe('"거실" 카메라 켜기');
  });
});

describe('parseStoredFacing', () => {
  it('저장된 세 방식을 그대로 돌려준다', () => {
    expect(parseStoredFacing('user')).toBe('user');
    expect(parseStoredFacing('environment')).toBe('environment');
    expect(parseStoredFacing('screen')).toBe('screen');
  });
  it('없거나 알 수 없는 값은 전면', () => {
    expect(parseStoredFacing(null)).toBe('user');
    expect(parseStoredFacing(undefined)).toBe('user');
    expect(parseStoredFacing('rear')).toBe('user');
  });
});

describe('getCardStatus', () => {
  const base = { isThisDevice: false, isConnecting: false };
  it('연결됨은 영상을 보내고 있다고 안내한다', () => {
    expect(getCardStatus({ ...base, status: 'running' })).toMatchObject({
      label: '켜짐',
      tone: 'connected',
      message: '지금 영상을 보내고 있어요',
    });
  });
  it('상태를 모르면 확인 중', () => {
    expect(getCardStatus({ ...base, status: null })).toMatchObject({ label: '확인 중', tone: 'checking' });
  });
  it('이 기기가 시작하는 중이면 연결하는 중(서버 상태보다 우선)', () => {
    expect(getCardStatus({ status: 'disconnected', isThisDevice: true, isConnecting: true })).toMatchObject({
      label: '켜는 중...',
      tone: 'connecting',
    });
  });
  it('다른 기기 카드는 시작 중 상태를 따르지 않는다', () => {
    expect(getCardStatus({ status: 'disconnected', isThisDevice: false, isConnecting: true })).toMatchObject({
      label: '꺼짐',
    });
  });
  it('끊김 안내는 이 기기와 다른 기기가 다르다', () => {
    expect(getCardStatus({ status: 'disconnected', isThisDevice: true, isConnecting: false }).message).toContain('카메라 켜기');
    expect(getCardStatus({ ...base, status: 'offline' }).message).toContain('화면을 켜 두세요');
  });
});

describe('getCaptureSize', () => {
  it('회전 없이 찍힌 그대로 - 세로 원본 720x1280은 그대로 보낸다', () => {
    expect(getCaptureSize(720, 1280)).toEqual({ width: 720, height: 1280 });
  });
  it('가로 1280 이하는 줄이지 않는다', () => {
    expect(getCaptureSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(getCaptureSize(640, 480)).toEqual({ width: 640, height: 480 });
  });
  it('가로가 1280을 넘을 때만 비율대로 줄인다', () => {
    expect(getCaptureSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(getCaptureSize(2560, 1600)).toEqual({ width: 1280, height: 800 });
  });
  it('영상 크기를 아직 모르면(0) 1280x720 기준', () => {
    expect(getCaptureSize(0, 0)).toEqual({ width: 1280, height: 720 });
  });
});

describe('isThisDeviceConnecting', () => {
  const idle = { isTurningOn: false, isModalStarting: false, isAwaitingRunning: false };
  it('켜는 중이거나 모달이 시작 중이면 연결하는 중', () => {
    expect(isThisDeviceConnecting({ ...idle, isTurningOn: true, status: 'disconnected' })).toBe(true);
    expect(isThisDeviceConnecting({ ...idle, isModalStarting: true, status: 'offline' })).toBe(true);
  });
  it('송출을 시작했고 서버가 아직 running이 아니면 연결하는 중', () => {
    expect(isThisDeviceConnecting({ ...idle, isAwaitingRunning: true, status: 'disconnected' })).toBe(true);
    expect(isThisDeviceConnecting({ ...idle, isAwaitingRunning: true, status: null })).toBe(true);
    expect(isThisDeviceConnecting({ ...idle, isAwaitingRunning: true, status: undefined })).toBe(true);
  });
  it('서버가 running이면 기다림을 끝낸다', () => {
    expect(isThisDeviceConnecting({ ...idle, isAwaitingRunning: true, status: 'running' })).toBe(false);
  });
  it('기다림이 끝나면(상한 경과·송출 꺼짐) 서버 상태를 그대로 보여 준다', () => {
    expect(isThisDeviceConnecting({ ...idle, status: 'disconnected' })).toBe(false);
  });
});

describe('isPortraitFrame', () => {
  it('세로 영상(자동 회전 꺼짐·가로로 들었을 때 오는 720x1280)이면 안내한다', () => {
    expect(isPortraitFrame(720, 1280)).toBe(true);
  });
  it('가로·정사각 영상은 안내하지 않는다', () => {
    expect(isPortraitFrame(1280, 720)).toBe(false);
    expect(isPortraitFrame(720, 720)).toBe(false);
  });
  it('크기를 아직 모르면 안내하지 않는다', () => {
    expect(isPortraitFrame(0, 0)).toBe(false);
  });
});

describe('canGoNextStep', () => {
  it('1단계는 방을 골라야 넘어간다', () => {
    expect(canGoNextStep(1, { room: '', facingChosen: false })).toBe(false);
    expect(canGoNextStep(1, { room: '베란다', facingChosen: false })).toBe(true);
  });
  it('2단계(기기 놓기)는 안내만 보고 넘어간다', () => {
    expect(canGoNextStep(2, { room: '베란다', facingChosen: false })).toBe(true);
  });
  it('3단계는 촬영 방식을 직접 골라야 넘어간다', () => {
    expect(canGoNextStep(3, { room: '베란다', facingChosen: false })).toBe(false);
    expect(canGoNextStep(3, { room: '베란다', facingChosen: true })).toBe(true);
  });
  it('4단계는 마지막이라 다음이 없다(등록 버튼이 대신한다)', () => {
    expect(canGoNextStep(4, { room: '베란다', facingChosen: true })).toBe(false);
  });
});

describe('formatRegisteredDate', () => {
  it('카드 등록일은 "YYYY년 M월 D일에 등록"', () => {
    expect(formatRegisteredDate('2026-03-02T10:15:00')).toBe('2026년 3월 2일에 등록');
    expect(formatRegisteredDate('2026-10-05T09:00:00')).toBe('2026년 10월 5일에 등록');
  });
  it('날짜가 없거나 읽을 수 없으면 빈 문자열(줄을 그리지 않는다)', () => {
    expect(formatRegisteredDate(null)).toBe('');
    expect(formatRegisteredDate('not-a-date')).toBe('');
  });
});

describe('getFacingLabel', () => {
  it('요약에 보이는 촬영 방식 이름', () => {
    expect(getFacingLabel('user')).toBe('전면 카메라');
    expect(getFacingLabel('environment')).toBe('후면 카메라');
    expect(getFacingLabel('screen')).toBe('화면');
  });
});

describe('isSourceFresh - 멈춘 장면은 보내지 않는다', () => {
  const live = {
    isScreen: false,
    visible: true,
    hiddenStopsCamera: true,
    trackLive: true,
    trackMuted: false,
    videoPaused: false,
  };
  it('카메라가 살아 있고 화면이 보이면 보낸다(고정된 카메라의 조용한 장면도 보낸다)', () => {
    expect(isSourceFresh(live)).toBe(true);
  });
  it('폰 화면이 꺼지면(숨겨짐) 보내지 않는다', () => {
    expect(isSourceFresh({ ...live, visible: false })).toBe(false);
  });
  it('PC는 탭이 숨겨져도 웹캠이 계속 찍으므로 보낸다', () => {
    expect(isSourceFresh({ ...live, visible: false, hiddenStopsCamera: false })).toBe(true);
  });
  it('카메라가 끊겼거나·일시 중지됐거나·영상이 멈췄으면 보내지 않는다', () => {
    expect(isSourceFresh({ ...live, trackLive: false })).toBe(false);
    expect(isSourceFresh({ ...live, trackMuted: true })).toBe(false);
    expect(isSourceFresh({ ...live, videoPaused: true })).toBe(false);
  });
  it('화면 공유는 숨겨진 채 쓰는 게 정상이라 트랙만 본다', () => {
    expect(isSourceFresh({ ...live, isScreen: true, visible: false, videoPaused: true, trackMuted: true })).toBe(true);
    expect(isSourceFresh({ ...live, isScreen: true, trackLive: false })).toBe(false);
  });
});

describe('shouldRecoverCamera', () => {
  const base = { isScreen: false, visible: true, staleForMs: 3000, msSinceLastRecover: 10000, recovering: false };
  it('화면이 보이고 3초 넘게 멈춰 있으면 카메라를 다시 켠다', () => {
    expect(shouldRecoverCamera(base)).toBe(true);
  });
  it('멈춘 지 얼마 안 됐거나, 방금 시도했거나, 시도 중이면 기다린다', () => {
    expect(shouldRecoverCamera({ ...base, staleForMs: 2999 })).toBe(false);
    expect(shouldRecoverCamera({ ...base, msSinceLastRecover: 9999 })).toBe(false);
    expect(shouldRecoverCamera({ ...base, recovering: true })).toBe(false);
  });
  it('화면이 꺼져 있는 동안·화면 공유는 자동으로 다시 켜지 않는다', () => {
    expect(shouldRecoverCamera({ ...base, visible: false })).toBe(false);
    expect(shouldRecoverCamera({ ...base, isScreen: true })).toBe(false);
  });
});

describe('isMobileCameraDevice', () => {
  it('안드로이드·아이폰·아이패드는 모바일', () => {
    expect(isMobileCameraDevice('Mozilla/5.0 (Linux; Android 14; SM-S918N)', 5)).toBe(true);
    expect(isMobileCameraDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isMobileCameraDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);   // iPadOS
  });
  it('PC 브라우저는 모바일이 아니다', () => {
    expect(isMobileCameraDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe(false);
    expect(isMobileCameraDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
  });
});

describe('찍히는 장면 보기 - 시각과 안내', () => {
  it('장면 시각은 "M월 D일 오전/오후 h:mm"', () => {
    expect(formatSceneTime('2026-10-15T10:35:24')).toBe('10월 15일 오전 10:35');
    expect(formatSceneTime('2026-10-14T15:08:00')).toBe('10월 14일 오후 3:08');
    expect(formatSceneTime('2026-10-14T00:05:00')).toBe('10월 14일 오전 12:05');
    expect(formatSceneTime('2026-10-14T12:00:00')).toBe('10월 14일 오후 12:00');
    expect(formatSceneTime(null)).toBe('');
  });
  it('켜져 있으면 계속 새로 받는다고, 꺼져 있으면 마지막 장면과 시각을 알린다', () => {
    expect(getSceneCaption('running', '2026-10-15T10:35:24')).toBe('몇 초마다 새로 보여 드려요');
    expect(getSceneCaption('disconnected', '2026-10-14T15:08:00')).toBe('마지막으로 보낸 장면 · 10월 14일 오후 3:08');
    expect(getSceneCaption('offline', null)).toBe('마지막으로 보낸 장면');
  });
});
