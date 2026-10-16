'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getStoredDeviceId } from '@/lib/device/deviceId';
import { wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import type { WardLiveCamera } from '@/service/interface/ward/camera';
import { showToast } from '@/store/toastStore';
import { CameraRegisterModal, type CameraRegisterModalHandle } from './CameraRegisterModal';
import {
  ALREADY_STREAMING,
  AWAIT_RUNNING_MS,
  getCameraPrimaryAction,
  isThisDeviceConnecting,
  type CameraPrimaryAction,
} from './cameraAction';

type WardCameraStream = {
  cameras: WardLiveCamera[];
  isLiveError: boolean;
  myCamera: WardLiveCamera | undefined;
  primaryAction: CameraPrimaryAction;
  isConnecting: boolean;
  isPrimaryBusy: boolean;
  isStreamUnstable: boolean;
  isSurveillanceLost: boolean;
  onPrimary: () => Promise<void>;
  openRegister: () => void;
  onThisDeviceDeleted: () => void;
};

const WardCameraStreamContext = createContext<WardCameraStream | null>(null);

export function useWardCameraStream(): WardCameraStream {
  const value = useContext(WardCameraStreamContext);
  if (!value) throw new Error('useWardCameraStream must be used inside WardCameraStreamProvider');
  return value;
}

// 이 기기의 카메라 송출 엔진(송출 창 + 송출 루프). 피보호자 웹 전체 레이아웃에 둔다 - '내 카메라' 페이지 안에 두면
// 다른 메뉴로 가거나 뒤로 가기를 할 때 페이지와 함께 사라져 송출이 끊겼다(2026-10-15). 피보호자 웹에 머무는 동안은
// 어느 화면에 있든 계속 보낸다. '내 카메라' 페이지는 useWardCameraStream 으로 이 엔진을 조작만 한다.
export function WardCameraStreamProvider({ children }: { children: ReactNode }) {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isStreamUnstable, setIsStreamUnstable] = useState(false);
  const [isSurveillanceLost, setIsSurveillanceLost] = useState(false);
  const [isTurningOn, setIsTurningOn] = useState(false);
  const [isModalStarting, setIsModalStarting] = useState(false);
  // 이 탭이 송출을 시작했고 서버가 아직 'running'을 알려 주지 않은 동안(최대 AWAIT_RUNNING_MS)
  const [isAwaitingRunning, setIsAwaitingRunning] = useState(false);
  // 이 탭이 실제로 송출 중인지 - 주 버튼(화면 보기 / 켜기)은 서버 상태가 아니라 이 값으로 정한다
  const [isStreamingHere, setIsStreamingHere] = useState(false);
  const modalRef = useRef<CameraRegisterModalHandle>(null);
  // 다른 페이지에서는 이 기기가 송출 중일 때만 상태를 갱신한다('내 카메라' 페이지는 목록이 15초마다 따로 갱신한다)
  const { data: cameras = [], isError: isLiveError } = useQuery({
    ...wardLiveCamerasQueryOptions,
    refetchInterval: isStreamingHere ? 15 * 1000 : false,
  });
  const myDeviceId = getStoredDeviceId();
  const myCamera = myDeviceId ? cameras.find(camera => camera.deviceId === myDeviceId) : undefined;
  const primaryAction = getCameraPrimaryAction(myCamera, isStreamingHere);
  const isConnecting = isThisDeviceConnecting({
    isTurningOn,
    isModalStarting,
    isAwaitingRunning,
    status: myCamera?.status,
  });
  // 켜는 중(아직 송출 전)에는 버튼을 막는다 - 이때 창을 열면 보여 줄 화면 없이 촬영 방식 고르기만 나온다
  const isPrimaryBusy = (isTurningOn || isModalStarting) && !isStreamingHere;

  const handleStreamingChange = (streaming: boolean) => {
    setIsStreamingHere(streaming);
    setIsAwaitingRunning(streaming);
  };

  useEffect(() => {
    if (!isAwaitingRunning) return;
    const timer = setTimeout(() => setIsAwaitingRunning(false), AWAIT_RUNNING_MS);
    return () => clearTimeout(timer);
  }, [isAwaitingRunning]);

  useEffect(() => {
    if (myCamera?.status === 'running') setIsAwaitingRunning(false);
  }, [myCamera?.status]);

  // 이 기기 카드의 주 버튼(카메라 화면 보기 / 카메라 켜기)
  const onPrimary = async () => {
    if (isPrimaryBusy) return;
    if (primaryAction.kind === 'turnOn') {
      setIsTurningOn(true);
      try {
        const failure = await modalRef.current?.turnOn();
        if (failure === ALREADY_STREAMING) setIsRegisterOpen(true);
        else if (failure) showToast(failure, { variant: 'error' });
      } finally {
        setIsTurningOn(false);
      }
      return;
    }
    setIsRegisterOpen(true);
  };

  const value: WardCameraStream = {
    cameras,
    isLiveError,
    myCamera,
    primaryAction,
    isConnecting,
    isPrimaryBusy,
    isStreamUnstable,
    isSurveillanceLost,
    onPrimary,
    openRegister: () => setIsRegisterOpen(true),
    onThisDeviceDeleted: () => {
      setIsRegisterOpen(false);
      void modalRef.current?.turnOff();
    },
  };

  return (
    <WardCameraStreamContext.Provider value={value}>
      {children}
      <CameraRegisterModal
        ref={modalRef}
        initialRoom={myCamera?.label}
        isCameraRunning={myCamera?.status === 'running'}
        connectionStatus={myCamera?.status ?? null}
        isConnecting={isConnecting}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onUnstableChange={setIsStreamUnstable}
        onSurveillanceLostChange={setIsSurveillanceLost}
        onStartingChange={setIsModalStarting}
        onStreamingChange={handleStreamingChange}
      />
    </WardCameraStreamContext.Provider>
  );
}
