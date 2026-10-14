'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getStoredDeviceId } from '@/lib/device/deviceId';
import { Icon } from '@/components/Icon';
import { wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import { showToast } from '@/store/toastStore';
import { CameraRegisterModal, type CameraRegisterModalHandle } from './CameraRegisterModal';
import { ALREADY_STREAMING, getCameraPrimaryAction } from './cameraAction';
import { WardCameraList } from './WardCameraList';
import styles from './WardCameraContent.module.css';

const cx = classNames.bind(styles);

export function WardCameraContent() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isStreamUnstable, setIsStreamUnstable] = useState(false);
  const [isTurningOn, setIsTurningOn] = useState(false);
  const [isModalStarting, setIsModalStarting] = useState(false);
  const modalRef = useRef<CameraRegisterModalHandle>(null);
  const { data: cameras = [], isError: isLiveError } = useQuery(wardLiveCamerasQueryOptions);
  const myDeviceId = getStoredDeviceId();
  const myCamera = myDeviceId ? cameras.find(camera => camera.deviceId === myDeviceId) : undefined;
  const action = getCameraPrimaryAction(myCamera);

  // 이 기기 카드의 주 버튼(카메라 화면 보기 / 카메라 켜기)
  const handlePrimary = async () => {
    if (action.kind === 'turnOn') {
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

  return (
    <section className={cx('page')}>
      {isStreamUnstable && <p className={cx('registerHint')}>송출이 끊기고 있어요. 화면을 켜 둔 채 잠시 기다려 주세요.</p>}
      {isLiveError && cameras.length === 0 && <p className={cx('registerHint')}>카메라 연결 상태를 확인하는 중이에요. 잠시만 기다려 주세요.</p>}
      {cameras.length > 0 && !myCamera && (
        <div className={cx('registerRow')}>
          <button type="button" className={cx('registerButton')} onClick={() => setIsRegisterOpen(true)}>
            <Icon name="plus" size={22} decorative />
            이 기기를 카메라로 등록
          </button>
        </div>
      )}

      <WardCameraList
        onRegister={() => setIsRegisterOpen(true)}
        primaryAction={action}
        isConnecting={isTurningOn || isModalStarting}
        onPrimary={handlePrimary}
      />

      <CameraRegisterModal
        ref={modalRef}
        initialRoom={myCamera?.label}
        isCameraRunning={myCamera?.status === 'running'}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onUnstableChange={setIsStreamUnstable}
        onStartingChange={setIsModalStarting}
      />
    </section>
  );
}
