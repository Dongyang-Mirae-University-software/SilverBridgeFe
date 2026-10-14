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
  const modalRef = useRef<CameraRegisterModalHandle>(null);
  const { data: cameras = [], isError: isLiveError } = useQuery(wardLiveCamerasQueryOptions);
  const myDeviceId = getStoredDeviceId();
  const myCamera = myDeviceId ? cameras.find(camera => camera.deviceId === myDeviceId) : undefined;
  const action = getCameraPrimaryAction(myCamera);

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
      {isStreamUnstable && <p className={cx('registerHint')}>송출이 불안정합니다. 네트워크 상태를 확인해 주세요.</p>}
      {isLiveError && cameras.length === 0 && <p className={cx('registerHint')}>카메라 연결 상태를 확인하는 중이에요. 잠시만 기다려 주세요.</p>}
      {cameras.length > 0 && <div className={cx('registerRow')}>
        <button
          type="button"
          className={cx('registerButton')}
          disabled={action.kind === 'checking' || isTurningOn}
          onClick={handlePrimary}
        >
          <Icon name={action.kind === 'register' ? 'plus' : 'camera'} size={22} decorative />
          {action.kind === 'register'
            ? '이 기기를 카메라로 등록'
            : isTurningOn
              ? '카메라 켜는 중...'
              : action.label}
        </button>
        {myCamera && (
          <p className={cx('registerHint')}>
            {action.kind === 'view' && `"${myCamera.label}" 카메라가 송출 중이에요.`}
            {action.kind === 'turnOn' && `이 기기는 "${myCamera.label}" 카메라예요. 꺼져 있다면 버튼을 눌러 다시 시작하세요.`}
            {action.kind === 'checking' && '연결 상태를 확인하고 있어요. 잠시만 기다려 주세요.'}
          </p>
        )}
        {!myCamera && (
          <p className={cx('registerHint')}>다른 기기에서 등록한 카메라는 그 기기에서 켜고 끌 수 있어요.</p>
        )}
      </div>}

      <WardCameraList onRegister={() => setIsRegisterOpen(true)} />

      <CameraRegisterModal
        ref={modalRef}
        initialRoom={myCamera?.label}
        isCameraRunning={myCamera?.status === 'running'}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onUnstableChange={setIsStreamUnstable}
      />
    </section>
  );
}
