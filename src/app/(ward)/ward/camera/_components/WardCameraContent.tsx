'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getStoredDeviceId } from '@/lib/device/deviceId';
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
      <div className={cx('registerRow')}>
        <button
          type="button"
          className={cx('registerButton')}
          disabled={Boolean(myCamera)}
          onClick={() => setIsRegisterOpen(true)}
        >
          + 이 기기를 카메라로 등록
        </button>
        {myCamera && (
          <p className={cx('registerHint')}>이 기기는 이미 &quot;{myCamera.label}&quot; 카메라로 쓰고 있어요.</p>
        )}
      </div>

      <WardCameraList />

      {isRegisterOpen && <CameraRegisterModal onClose={() => setIsRegisterOpen(false)} />}
    </section>
  );
}
