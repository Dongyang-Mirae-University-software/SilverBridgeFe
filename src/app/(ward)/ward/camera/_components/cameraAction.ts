import dayjs from 'dayjs';

import type { WardCameraConnectionStatus } from '@/service/interface/ward/camera';

// 피보호자 '내 카메라' 화면의 주 버튼 상태. 이 기기의 카메라 상태로만 정한다.
export type CameraPrimaryAction =
  | { kind: 'register' }
  | { kind: 'view'; label: string }
  | { kind: 'turnOn'; label: string }
  | { kind: 'checking'; label: string };

export function getCameraPrimaryAction(
  myCamera: { status: WardCameraConnectionStatus } | undefined,
): CameraPrimaryAction {
  if (!myCamera) return { kind: 'register' };
  if (myCamera.status === 'running') return { kind: 'view', label: '카메라 화면 보기' };
  if (myCamera.status === null) return { kind: 'checking', label: '연결 상태 확인 중' };
  return { kind: 'turnOn', label: '카메라 켜기' };
}

// 모달 제목. 송출 여부는 서버 상태가 아니라 이 탭의 실제 송출 상태로 정한다
// (서버는 running인데 이 탭은 송출하지 않는 경우 '화면 보기'를 약속하면 보여 줄 화면이 없다).
// 화면 보기는 영상만 보여 주는 화면이라 제목도 방 이름만 둔다(상태는 옆 배지가 알린다).
export function getModalTitle(initialRoom: string | undefined, isStreamingHere: boolean): string {
  if (!initialRoom) return '이 기기를 카메라로 등록';
  return isStreamingHere ? `${initialRoom} 카메라` : `"${initialRoom}" 카메라 켜기`;
}

// 송출 캔버스 크기. 회전 없이 찍힌 그대로 보내고, 가로가 1280을 넘을 때만 비율대로 줄인다
// (화면 공유는 getDisplayMedia에 크기 제한이 없어 원본 해상도가 그대로 올라온다).
export const MAX_CAPTURE_WIDTH = 1280;

export function getCaptureSize(videoWidth: number, videoHeight: number): { width: number; height: number } {
  const srcWidth = videoWidth || 1280;
  const srcHeight = videoHeight || 720;
  const scale = Math.min(1, MAX_CAPTURE_WIDTH / srcWidth);
  return { width: Math.round(srcWidth * scale), height: Math.round(srcHeight * scale) };
}

// 영상이 세로로 들어오는지. 휴대폰 '자동 회전'이 꺼져 있으면 가로로 들어도 세로 영상이 와서 장면이 옆으로 눕는다
// (브라우저는 실제로 어떻게 들었는지 알 수 없다) - 이때 자동 회전을 켜라고 안내한다. 크기를 모르면(0) 안내하지 않는다.
export function isPortraitFrame(videoWidth: number, videoHeight: number): boolean {
  return videoWidth > 0 && videoHeight > videoWidth;
}


// 송출을 시작한 뒤 서버가 'running'을 알려 줄 때까지 '연결하는 중'으로 보여 주는 최대 시간.
// 넘기면 서버가 알려 준 실제 상태를 보여 준다(무한히 '연결하는 중'에 머물지 않게).
export const AWAIT_RUNNING_MS = 45 * 1000;

// 이 기기 카드의 '연결하는 중' 여부. 송출 시작 직후에는 첫 영상이 올라가기 전이라 서버가 아직
// 'running'이 아니다 - 그 사이 '연결 안 됨·카메라 켜기'가 잠깐 보이지 않게 한다.
export function isThisDeviceConnecting(input: {
  isTurningOn: boolean;
  isModalStarting: boolean;
  isAwaitingRunning: boolean;
  status: WardCameraConnectionStatus | undefined;
}): boolean {
  const { isTurningOn, isModalStarting, isAwaitingRunning, status } = input;
  return isTurningOn || isModalStarting || (isAwaitingRunning && status !== 'running');
}

// turnOn 이 이미 송출 중이라 아무것도 하지 않았음을 알리는 값(오류 문구가 아니다)
export const ALREADY_STREAMING = 'ALREADY_STREAMING';

export type CameraFacing = 'user' | 'environment' | 'screen';

// 저장된 촬영 방식. 알 수 없는 값(옛 값·손상)은 기본 전면으로 돌린다.
export function parseStoredFacing(value: string | null | undefined): CameraFacing {
  return value === 'environment' || value === 'screen' ? value : 'user';
}

export type CardTone = 'checking' | 'connected' | 'disconnected' | 'connecting';

// 카드의 상태 배지와 안내 문구. '연결하는 중'은 이 기기가 송출을 시작하는 동안에만 쓴다.
export function getCardStatus(input: {
  status: WardCameraConnectionStatus;
  isThisDevice: boolean;
  isConnecting: boolean;
}): { label: string; tone: CardTone; message: string | null } {
  const { status, isThisDevice, isConnecting } = input;
  if (isThisDevice && isConnecting) {
    return { label: '연결하는 중...', tone: 'connecting', message: '촬영을 시작하고 있어요. 잠시만 기다려 주세요' };
  }
  if (status === null) {
    return { label: '확인 중', tone: 'checking', message: '상태를 확인하고 있어요. 잠시 후 다시 보여드려요' };
  }
  if (status === 'running') return { label: '연결됨', tone: 'connected', message: '지금 영상을 보내고 있어요' };
  return {
    label: '연결 안 됨',
    tone: 'disconnected',
    message: isThisDevice ? '"카메라 켜기"를 눌러 다시 시작하세요' : '카메라로 쓰는 기기의 화면을 켜 두세요',
  };
}

// 새 카메라 등록 마법사의 단계(시안 2026-10-15). 단계 이름은 진행 표시줄 아래에 그대로 보인다.
export const REGISTER_STEPS = ['방 고르기', '기기 놓기', '촬영 방식', '미리보기'] as const;
export type RegisterStep = 1 | 2 | 3 | 4;

// '다음'을 누를 수 있는지 - 방은 1단계, 촬영 방식은 3단계에서 골라야 넘어간다
export function canGoNextStep(step: RegisterStep, input: { room: string; facingChosen: boolean }): boolean {
  if (step === 1) return Boolean(input.room);
  if (step === 3) return input.facingChosen;
  return step === 2;
}

// 촬영 방식 선택지와 설명. 세 가지 모두 항상 고를 수 있다(화면 공유 포함, 2026-10-15 사용자 결정).
export const FACING_CHOICES: Array<{ value: CameraFacing; label: string; description: string }> = [
  { value: 'user', label: '전면 카메라', description: '화면 쪽 카메라로 찍어요. 화면을 보면서 방향을 맞추기 쉬워요' },
  { value: 'environment', label: '후면 카메라', description: '뒷면 카메라로 찍어요. 더 넓고 선명하게 보여요' },
  { value: 'screen', label: '화면', description: '기기 화면에 보이는 내용을 그대로 보내요' },
];

export function getFacingLabel(facing: CameraFacing): string {
  return FACING_CHOICES.find(choice => choice.value === facing)?.label ?? '';
}

// 카드의 등록일 - "2026년 3월 2일에 등록". 날짜를 읽을 수 없으면 빈 문자열(줄을 그리지 않는다)
export function formatRegisteredDate(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const date = dayjs(createdAt);
  return date.isValid() ? `${date.format('YYYY년 M월 D일')}에 등록` : '';
}

// 송출 원본 카메라가 새 프레임을 주고 있는지. 아니면 업로드하지 않는다.
// 폰 화면을 끄면 카메라는 멈추는데 <video>에는 마지막 장면이 남아, 예전에는 멈춘 장면을 계속 보내
// AI가 '연결됨'으로 보고 보호자에게 멈춘 영상이 보였다(2026-10-15 gosky). 보내지 않으면 AI가 10초 뒤 '연결 안 됨'으로 바꾼다.
// 그림이 같은지는 보지 않는다 - 고정된 카메라도 새 프레임은 계속 찍히고, 조용한 방도 이상감지를 위해 계속 보내야 한다.
// 새 프레임 감지(requestVideoFrameCallback)는 쓰지 않는다 - 숨겨진 <video>(모달을 닫은 평소 상태)에서는 호출이 멈출 수 있어
// 정상 카메라를 멈춤으로 오판할 수 있다. 확실한 신호(화면·트랙·재생 상태)만 본다.

export function isSourceFresh(input: {
  isScreen: boolean;
  visible: boolean;
  // 폰·태블릿은 화면이 꺼지거나 앱이 뒤로 가면(숨겨짐) 운영체제가 카메라를 멈춘다.
  // PC 브라우저는 탭이 숨겨져도 웹캠이 계속 진짜 프레임을 주므로 이 기준을 쓰지 않는다.
  hiddenStopsCamera: boolean;
  trackLive: boolean;
  trackMuted: boolean;
  videoPaused: boolean;
}): boolean {
  if (!input.trackLive) return false;
  // 화면 공유는 내용이 바뀔 때만 프레임이 나오고, 다른 탭을 띄워 이 탭이 숨겨진 채 쓰는 게 정상이다
  if (input.isScreen) return true;
  if (!input.visible && input.hiddenStopsCamera) return false;
  return !input.trackMuted && !input.videoPaused;
}

// 숨겨지면 카메라가 멈추는 기기(폰·태블릿)인지. iPadOS는 PC처럼 'Macintosh'로 알리지만 터치 지점이 여럿이다.
export function isMobileCameraDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

// 멈춘 상태가 이만큼 이어지면 카메라를 다시 켜 본다(재시도 간격은 RECOVER_COOLDOWN_MS)
export const RECOVER_AFTER_MS = 3000;
export const RECOVER_COOLDOWN_MS = 10000;

export function shouldRecoverCamera(input: {
  isScreen: boolean;
  visible: boolean;
  staleForMs: number;
  msSinceLastRecover: number;
  recovering: boolean;
}): boolean {
  // 화면 공유는 사용자가 직접 허락해야 다시 켜져서 자동 복구하지 않는다. 숨겨진 동안에는 카메라를 켤 수 없다
  if (input.isScreen || !input.visible || input.recovering) return false;
  return input.staleForMs >= RECOVER_AFTER_MS && input.msSinceLastRecover >= RECOVER_COOLDOWN_MS;
}

// 다른 기기 카메라의 "찍히는 장면 보기" - 송출 중이면 이 간격으로 새로 받는다(BE 제한 분 30회 안)
export const SCENE_REFRESH_MS = 3000;

// 장면 시각 - "10월 15일 오전 10:35" (로케일 설정과 무관하게 같은 글자로)
export function formatSceneTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = dayjs(value);
  if (!date.isValid()) return '';
  const hour = date.hour();
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${date.month() + 1}월 ${date.date()}일 ${meridiem} ${hour12}:${date.format('mm')}`;
}

// 장면 아래 안내 한 줄. 켜져 있으면 계속 새로 받고, 꺼져 있으면 마지막 장면과 그 시각을 알린다
export function getSceneCaption(status: WardCameraConnectionStatus, lastFrameAt: string | null | undefined): string {
  if (status === 'running') return '몇 초마다 새로 보여 드려요';
  const time = formatSceneTime(lastFrameAt);
  return time ? `마지막으로 보낸 장면 · ${time}` : '마지막으로 보낸 장면';
}
