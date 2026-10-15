'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { getStoredDeviceId } from '@/lib/device/deviceId';
import { useDeleteWardCameraMutation, wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import { WardLiveCamera } from '@/service/interface/ward/camera';
import { Icon } from '@/components/Icon';
import { showToast } from '@/store/toastStore';
import { formatRegisteredDate, getCardStatus, type CameraPrimaryAction } from './cameraAction';
import { RemoveCameraDialog } from './RemoveCameraDialog';
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
  onThisDeviceDeleted,
}: {
  onRegister: () => void;
  // 이 기기 카드의 주 버튼. 다른 기기 카드에는 버튼을 두지 않는다(영상 시청은 보호자 전용)
  primaryAction: CameraPrimaryAction;
  isConnecting: boolean;
  onPrimary: () => void;
  // 이 기기의 카메라를 등록 해제했을 때 - 이 탭의 송출을 끄게 한다
  onThisDeviceDeleted?: () => void;
}) {
  const { data, isLoading } = useQuery(wardLiveCamerasQueryOptions);
  const cameras = data ?? [];
  const myDeviceId = getStoredDeviceId();
  const [renamingCamera, setRenamingCamera] = useState<WardLiveCamera | null>(null);
  const [removing, setRemoving] = useState<{ camera: WardLiveCamera; isThisDevice: boolean } | null>(null);

  const deleteMutation = useDeleteWardCameraMutation();

  const handleDelete = () => {
    if (!removing) return;
    const { camera, isThisDevice } = removing;
    deleteMutation.mutate(camera.id, {
      // 이 기기의 카메라면 송출도 끈다 - 그대로 두면 지워진 카메라로 계속 보내고, 다시 등록할 때 '카메라 끄기'부터 보인다
      onSuccess: () => {
        setRemoving(null);
        if (isThisDevice) onThisDeviceDeleted?.();
      },
      onError: error => {
        setRemoving(null);
        showToast(getErrorMessage(error, '카메라를 삭제하지 못했습니다.'), { variant: 'error' });
      },
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
          const registeredDate = formatRegisteredDate(camera.createdAt);
          // 시작하는 동안에도 화면은 열 수 있다(확인은 '카메라 화면 보기'로 한다)
          const primaryLabel = isConnecting ? '카메라 화면 보기' : 'label' in primaryAction ? primaryAction.label : '';

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

              {registeredDate && (
                <p className={cx('meta')}>
                  <Icon name="calendar" size={18} decorative />
                  {registeredDate}
                </p>
              )}

              {showPrimary && (
                <button
                  type="button"
                  className={cx('primaryButton')}
                  disabled={primaryAction.kind === 'checking' && !isConnecting}
                  onClick={onPrimary}
                >
                  <Icon name="camera" size={22} decorative />
                  {primaryLabel}
                </button>
              )}

              <div className={cx('actions')}>
                <button type="button" className={cx('linkButton')} onClick={() => setRenamingCamera(camera)}>
                  방 이름 바꾸기
                </button>
                <button
                  type="button"
                  className={cx('linkButton', 'danger')}
                  onClick={() => setRemoving({ camera, isThisDevice })}
                >
                  <Icon name="trash" size={18} decorative />
                  등록 해제
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {renamingCamera && <RoomRenameModal camera={renamingCamera} onClose={() => setRenamingCamera(null)} />}
      {removing && (
        <RemoveCameraDialog
          label={removing.camera.label}
          isThisDevice={removing.isThisDevice}
          isPending={deleteMutation.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}
