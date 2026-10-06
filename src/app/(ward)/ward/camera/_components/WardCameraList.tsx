'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getStoredDeviceId } from '@/lib/device/deviceId';
import { useDeleteWardCameraMutation, wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import { WardCameraConnectionStatus, WardLiveCamera } from '@/service/interface/ward/camera';
import { formatDateTime } from '@/utils/format/date';
import { showToast } from '@/store/toastStore';
import { RoomRenameModal } from './RoomRenameModal';
import styles from './WardCameraList.module.css';

const cx = classNames.bind(styles);

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

function getStatusBadge(status: WardCameraConnectionStatus) {
  if (status === null) return { label: '확인 중', tone: 'checking' } as const;
  if (status === 'running') return { label: '연결됨', tone: 'connected' } as const;
  return { label: '연결 안 됨', tone: 'disconnected' } as const;
}

export function WardCameraList() {
  const { data, isLoading } = useQuery(wardLiveCamerasQueryOptions);
  const cameras = data ?? [];
  const myDeviceId = getStoredDeviceId();
  const [renamingCamera, setRenamingCamera] = useState<WardLiveCamera | null>(null);

  const deleteMutation = useDeleteWardCameraMutation();

  const handleDelete = (camera: WardLiveCamera) => {
    const confirmed = window.confirm(
      `"${camera.label}" 카메라를 등록 해제할까요?\n해제하면 이 방의 이상 상황 알림이 오지 않고, 저장된 영상도 지워져요.`,
    );
    if (!confirmed) return;

    deleteMutation.mutate(camera.id, {
      onError: error => showToast(getErrorMessage(error, '카메라를 삭제하지 못했습니다.'), { variant: 'error' }),
    });
  };

  if (isLoading) return <p className={cx('emptyText')}>등록된 카메라를 불러오는 중입니다.</p>;
  if (cameras.length === 0) return <p className={cx('emptyText')}>아직 등록된 카메라가 없습니다.</p>;

  return (
    <section className={cx('card')}>
      <strong className={cx('title')}>내 카메라</strong>
      <ul className={cx('list')}>
        {cameras.map(camera => {
          const badge = getStatusBadge(camera.status);
          const isThisDevice = Boolean(myDeviceId) && camera.deviceId === myDeviceId;

          return (
            <li key={camera.id} className={cx('item')}>
              <div className={cx('itemHead')}>
                <span className={cx('label')}>{camera.label}</span>
                <span className={cx('statusBadge', badge.tone)}>
                  <span className={cx('statusDot')} />
                  {badge.label}
                </span>
                {isThisDevice && <span className={cx('deviceTag')}>이 기기</span>}
              </div>

              <span className={cx('meta')}>{formatDateTime(camera.createdAt)} 등록</span>

              <div className={cx('actions')}>
                <button type="button" className={cx('linkButton')} onClick={() => setRenamingCamera(camera)}>
                  방 이름 바꾸기
                </button>
                <button type="button" className={cx('linkButton', 'danger')} onClick={() => handleDelete(camera)}>
                  등록 해제
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {renamingCamera && <RoomRenameModal camera={renamingCamera} onClose={() => setRenamingCamera(null)} />}
    </section>
  );
}
