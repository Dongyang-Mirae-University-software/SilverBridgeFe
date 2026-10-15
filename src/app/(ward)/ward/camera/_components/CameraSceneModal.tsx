'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { fetchWardCameraLatestFrame } from '@/service/api/ward/camera';
import { wardLiveCamerasQueryOptions } from '@/service/query/ward/camera';
import type { WardCameraFrameError } from '@/service/interface/ward/camera';
import { SCENE_REFRESH_MS, getCardStatus, getSceneCaption } from './cameraAction';
import styles from './CameraSceneModal.module.css';

const cx = classNames.bind(styles);

type SceneState = { kind: 'loading' } | { kind: 'image'; url: string } | { kind: 'empty' } | { kind: 'error' };

// 다른 기기로 등록한 카메라가 찍는 장면(정지 화면). 어느 방을 비추는 기기인지 알아보는 용도다.
// 그 기기가 이미 보낸 장면만 받아 올 뿐 카메라를 켜거나 끄지 않는다(실시간 영상은 보호자 전용).
export function CameraSceneModal({ cameraId, onClose }: { cameraId: number; onClose: () => void }) {
  const { data: cameras = [] } = useQuery(wardLiveCamerasQueryOptions);
  const camera = cameras.find(item => item.id === cameraId);
  const status = camera?.status ?? null;
  const [scene, setScene] = useState<SceneState>({ kind: 'loading' });

  // 송출 중이면 3초마다 새로 받고, 꺼져 있으면 마지막 장면을 한 번만 받는다
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let currentUrl: string | null = null;

    const load = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const blob = await fetchWardCameraLatestFrame(cameraId);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          currentUrl = url;
          setScene({ kind: 'image', url });
        } catch (error) {
          if (cancelled) return;
          const { code } = (error ?? {}) as WardCameraFrameError;
          // 이미 보여 주던 장면이 있으면 일시적인 실패로 지우지 않는다
          setScene(previous =>
            previous.kind === 'image' ? previous : { kind: code === 'CAMERA_NOT_STREAMING' ? 'empty' : 'error' },
          );
        }
      }
      if (!cancelled && status === 'running') timer = setTimeout(load, SCENE_REFRESH_MS);
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [cameraId, status]);

  if (!camera) return null;
  const badge = getCardStatus({ status, isThisDevice: false, isConnecting: false });

  return (
    <div className={cx('overlay')} role="presentation" onClick={onClose}>
      <section
        className={cx('modal')}
        role="dialog"
        aria-modal="true"
        aria-label={`${camera.label} 카메라`}
        onClick={event => event.stopPropagation()}
      >
        <header className={cx('header')}>
          <strong>{camera.label} 카메라</strong>
          <span className={cx('statusBadge', badge.tone)}>
            <span className={cx('statusDot')} />
            {badge.label}
          </span>
          <button type="button" className={cx('closeButton')} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={cx('sceneBox')}>
          {scene.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={scene.url} alt={`${camera.label} 카메라가 찍는 장면`} className={cx('sceneImage')} />
          ) : (
            <p className={cx('placeholder')}>
              {scene.kind === 'loading'
                ? '장면을 불러오는 중이에요'
                : scene.kind === 'empty'
                  ? '아직 받은 장면이 없어요'
                  : '지금은 장면을 불러올 수 없어요. 잠시 후 다시 열어 주세요'}
            </p>
          )}
        </div>

        {scene.kind === 'image' && <p className={cx('caption')}>{getSceneCaption(status, camera.lastFrameAt)}</p>}

        <footer className={cx('footer')}>
          <button type="button" className={cx('primaryButton')} onClick={onClose}>
            닫기
          </button>
        </footer>
      </section>
    </div>
  );
}
