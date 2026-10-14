'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getStoredDeviceId } from '@/lib/device/deviceId';
import { useDeleteWardCameraMutation, wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import { WardLiveCamera } from '@/service/interface/ward/camera';
import { formatDateTime } from '@/utils/format/date';
import { Icon } from '@/components/Icon';
import { showToast } from '@/store/toastStore';
import { getCardStatus, type CameraPrimaryAction } from './cameraAction';
import { RoomRenameModal } from './RoomRenameModal';
import styles from './WardCameraList.module.css';

const cx = classNames.bind(styles);

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

export function WardCameraList({
  onRegister,
  primaryAction,
  isConnecting,
  onPrimary,
}: {
  onRegister: () => void;
  // 이 기기 카드의 주 버튼. 다른 기기 카드에는 버튼을 두지 않는다(영상 시청은 보호자 전용)
  primaryAction: CameraPrimaryAction;
  isConnecting: boolean;
  onPrimary: () => void;
}) {
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
  if (cameras.length === 0) {
    return (
      <section className={cx('emptyCard')}>
        <span className={cx('emptyIllustration')}><Icon name="camera" size={52} decorative /></span>
        <strong>아직 등록한 카메라가 없어요</strong>
        <button type="button" className={cx('emptyRegisterButton')} onClick={onRegister}>
          <Icon name="plus" size={22} decorative />이 기기를 카메라로 등록
        </button>
      </section>
    );
  }

  return (
    <section>
      <ul className={cx('list')}>
        {cameras.map(camera => {
          const isThisDevice = Boolean(myDeviceId) && camera.deviceId === myDeviceId;
          const card = getCardStatus({ status: camera.status, isThisDevice, isConnecting });
          const showPrimary = isThisDevice && primaryAction.kind !== 'register';

          return (
            <li key={camera.id} className={cx('item')}>
              <div className={cx('itemHead')}>
                <span className={cx('cameraIcon')}><Icon name="camera" size={28} decorative /></span>
                <div className={cx('cameraInfo')}>
                  <div className={cx('labelRow')}>
                    <span className={cx('label')}>{camera.label}</span>
                    {isThisDevice && <span className={cx('deviceTag')}>이 기기</span>}
                  </div>
                  <span className={cx('statusBadge', card.tone)}><span className={cx('statusDot')} />{card.label}</span>
                </div>
              </div>

              {card.message && (
                <p className={cx('statusMessage', { checkingMessage: card.tone === 'checking' || card.tone === 'connecting' })}>
                  {card.message}
                </p>
              )}

              <div className={cx('meta')}><span>등록일</span><strong>{formatDateTime(camera.createdAt)}</strong></div>

              {showPrimary && (
                <button
                  type="button"
                  className={cx('primaryButton')}
                  disabled={primaryAction.kind === 'checking' || isConnecting}
                  onClick={onPrimary}
                >
                  <Icon name="camera" size={22} decorative />
                  {isConnecting ? '카메라 켜는 중...' : 'label' in primaryAction ? primaryAction.label : ''}
                </button>
              )}

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
