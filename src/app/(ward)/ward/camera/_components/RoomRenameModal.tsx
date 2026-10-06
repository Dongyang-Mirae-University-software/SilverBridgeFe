'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { useUpdateWardCameraMutation, wardCameraRoomsQueryOptions } from '@/service/query/ward/camera';
import { WardLiveCamera } from '@/service/interface/ward/camera';
import { showToast } from '@/store/toastStore';
import { RoomPicker } from './RoomPicker';
import styles from './RoomRenameModal.module.css';

const cx = classNames.bind(styles);

function getErrorCode(error: unknown) {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

export function RoomRenameModal({ camera, onClose }: { camera: WardLiveCamera; onClose: () => void }) {
  const [selected, setSelected] = useState(camera.label);
  const [errorMessage, setErrorMessage] = useState('');
  const { data: rooms = [], refetch: refetchRooms } = useQuery(wardCameraRoomsQueryOptions);
  const updateMutation = useUpdateWardCameraMutation();

  const canSave = Boolean(selected) && selected !== camera.label && !updateMutation.isPending;

  const handleSave = () => {
    if (!canSave) return;
    setErrorMessage('');

    updateMutation.mutate(
      { id: camera.id, body: { label: selected } },
      {
        onSuccess: () => onClose(),
        onError: error => {
          if (getErrorCode(error) === 'CAMERA_LABEL_DUPLICATED') {
            void refetchRooms();
            setErrorMessage('방금 다른 기기에서 그 방을 등록했어요. 다른 방을 골라 주세요.');
            return;
          }
          const message = getErrorMessage(error, '방 이름을 바꾸지 못했습니다.');
          setErrorMessage(message);
          showToast(message, { variant: 'error' });
        },
      },
    );
  };

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <div
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label="방 이름 바꾸기"
        onClick={event => event.stopPropagation()}
      >
        <header className={cx('header')}>
          <strong>방 이름 바꾸기</strong>
          <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('body')}>
          <RoomPicker rooms={rooms} selectedLabel={selected} currentLabel={camera.label} onSelect={setSelected} />
          {errorMessage && <p className={cx('error')}>{errorMessage}</p>}
        </div>

        <footer className={cx('footer')}>
          <button type="button" className={cx('cancelButton')} onClick={onClose}>
            취소
          </button>
          <button type="button" className={cx('saveButton')} disabled={!canSave} onClick={handleSave}>
            {updateMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
