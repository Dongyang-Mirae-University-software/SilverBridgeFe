'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { wardCamerasQueryOptions, useDeleteWardCameraMutation, useUpdateWardCameraMutation } from '@/service/query/ward/camera';
import { WardCamera } from '@/service/interface/ward/camera';
import { showToast } from '@/store/toastStore';
import styles from './WardCameraList.module.css';

const cx = classNames.bind(styles);

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { message?: string })?.message ?? fallback;
}

export function WardCameraList() {
  const { data, isLoading } = useQuery(wardCamerasQueryOptions);
  const cameras = data ?? [];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const updateMutation = useUpdateWardCameraMutation();
  const deleteMutation = useDeleteWardCameraMutation();

  const startEdit = (camera: WardCamera) => {
    setEditingId(camera.id);
    setEditingLabel(camera.label);
  };

  const saveEdit = (id: number) => {
    const label = editingLabel.trim();
    if (!label) return;
    updateMutation.mutate(
      { id, body: { label } },
      {
        onSuccess: () => setEditingId(null),
        onError: error => showToast(getErrorMessage(error, '방 이름을 바꾸지 못했습니다.'), { variant: 'error' }),
      },
    );
  };

  const handleToggleActive = (camera: WardCamera, isActive: boolean) => {
    updateMutation.mutate(
      { id: camera.id, body: { isActive } },
      {
        onError: error => showToast(getErrorMessage(error, '설정을 바꾸지 못했습니다.'), { variant: 'error' }),
      },
    );
  };

  const handleDelete = (camera: WardCamera) => {
    if (!window.confirm(`"${camera.label}" 카메라를 삭제할까요?`)) return;
    deleteMutation.mutate(camera.id, {
      onError: error => showToast(getErrorMessage(error, '카메라를 삭제하지 못했습니다.'), { variant: 'error' }),
    });
  };

  if (isLoading) return <p className={cx('emptyText')}>등록된 카메라를 불러오는 중입니다.</p>;
  if (cameras.length === 0) return <p className={cx('emptyText')}>아직 등록된 카메라가 없습니다.</p>;

  return (
    <section className={cx('card')}>
      <strong className={cx('title')}>등록된 카메라</strong>
      <ul className={cx('list')}>
        {cameras.map(camera => (
          <li key={camera.id} className={cx('item')}>
            {editingId === camera.id ? (
              <input
                className={cx('labelInput')}
                value={editingLabel}
                onChange={event => setEditingLabel(event.target.value)}
                maxLength={30}
                autoFocus
              />
            ) : (
              <span className={cx('label')}>{camera.label}</span>
            )}

            <div className={cx('actions')}>
              {editingId === camera.id ? (
                <>
                  <button type="button" className={cx('linkButton')} onClick={() => saveEdit(camera.id)}>
                    저장
                  </button>
                  <button type="button" className={cx('linkButton')} onClick={() => setEditingId(null)}>
                    취소
                  </button>
                </>
              ) : (
                <button type="button" className={cx('linkButton')} onClick={() => startEdit(camera)}>
                  방 이름 수정
                </button>
              )}

              <label className={cx('toggleField')}>
                <input
                  type="checkbox"
                  checked={camera.isActive}
                  disabled={updateMutation.isPending}
                  onChange={event => handleToggleActive(camera, event.target.checked)}
                />
                사용 중
              </label>

              <button type="button" className={cx('linkButton', 'danger')} onClick={() => handleDelete(camera)}>
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
