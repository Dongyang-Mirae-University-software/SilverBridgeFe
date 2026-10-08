'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getStoredDeviceId } from '@/lib/device/deviceId';
import { Icon } from '@/components/Icon';
import { wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import { CameraRegisterModal } from './CameraRegisterModal';
import { WardCameraList } from './WardCameraList';
import styles from './WardCameraContent.module.css';

const cx = classNames.bind(styles);

export function WardCameraContent() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const { data: cameras = [] } = useQuery(wardLiveCamerasQueryOptions);
  const myDeviceId = getStoredDeviceId();
  const myCamera = myDeviceId ? cameras.find(camera => camera.deviceId === myDeviceId) : undefined;

  return (
    <section className={cx('page')}>
      {cameras.length > 0 && <div className={cx('registerRow')}>
        <button type="button" className={cx('registerButton')} onClick={() => setIsRegisterOpen(true)}>
          <Icon name={myCamera?.status === 'running' ? 'gear' : 'plus'} size={22} decorative />
          {myCamera
            ? `"${myCamera.label}" 카메라 ${myCamera.status === 'running' ? '관리' : '다시 켜기'}`
            : '이 기기를 카메라로 등록'}
        </button>
        {myCamera && (
          <p className={cx('registerHint')}>
            {myCamera.status === 'running'
              ? '카메라가 송출 중입니다. 전송 화면의 방향을 확인하거나 송출을 멈출 수 있어요.'
              : `이 기기는 이미 "${myCamera.label}" 카메라로 등록돼 있어요. 화면이 꺼졌거나 연결이 끊겼다면 다시 켤 수 있어요.`}
          </p>
        )}
      </div>}

      <WardCameraList onRegister={() => setIsRegisterOpen(true)} />

      <CameraRegisterModal
        initialRoom={myCamera?.label}
        isCameraRunning={myCamera?.status === 'running'}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />
    </section>
  );
}
