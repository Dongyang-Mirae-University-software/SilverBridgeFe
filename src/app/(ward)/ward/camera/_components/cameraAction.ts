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
export function getModalTitle(initialRoom: string | undefined, isStreamingHere: boolean): string {
  if (!initialRoom) return '이 기기를 카메라로 등록';
  return `"${initialRoom}" ${isStreamingHere ? '카메라 화면 보기' : '카메라 켜기'}`;
}

// turnOn 이 이미 송출 중이라 아무것도 하지 않았음을 알리는 값(오류 문구가 아니다)
export const ALREADY_STREAMING = 'ALREADY_STREAMING';

export type CameraFacing = 'user' | 'environment' | 'screen';

// 저장된 촬영 방식. 알 수 없는 값(옛 값·손상)은 기본 전면으로 돌린다.
export function parseStoredFacing(value: string | null | undefined): CameraFacing {
  return value === 'environment' || value === 'screen' ? value : 'user';
}
