'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 말벗 음성 대답 동안 앞면 카메라로 표정 사진을 몇 장 찍는다
// - 2초마다 1장(켜진 직후 1장 포함), 최대 5장, 짧은 쪽 640px 안팎 JPEG, 장당 1MB 이하(넘으면 품질을 낮춰 다시)
// - 사진은 이 훅의 메모리에만 있다가 take()로 넘기면 버린다. 브라우저 저장소·로그에 남기지 않는다
// - 카메라가 없거나 거부되면 open()이 false - 부르는 쪽은 목소리만 보낸다

export const FACE_FRAME_INTERVAL_MS = 2000;
export const FACE_FRAME_MAX = 5;
export const FACE_FRAME_MAX_BYTES = 1024 * 1024;
const SHORT_SIDE_PX = 640;
const QUALITIES = [0.82, 0.65, 0.5, 0.35];

export type FaceCameraResult = 'on' | 'denied' | 'unsupported' | 'cancelled';

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality));
}

// 짧은 쪽을 640px로 맞추고(작으면 그대로) 1MB 이하가 될 때까지 품질을 낮춘다. 끝내 크면 버린다
export async function captureJpeg(video: HTMLVideoElement): Promise<Blob | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, SHORT_SIDE_PX / Math.min(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of QUALITIES) {
    const blob = await canvasToJpeg(canvas, quality);
    if (blob && blob.size > 0 && blob.size <= FACE_FRAME_MAX_BYTES) return blob;
  }
  return null;
}

type Shot = {
  stream: MediaStream;
  video: HTMLVideoElement;
  frames: Blob[];
  pending: Promise<void>[];
  timer: ReturnType<typeof setInterval> | null;
};

export function useFaceFrames() {
  // 미리보기용 - 켜져 있는 동안만 값이 있다
  const [stream, setStream] = useState<MediaStream | null>(null);
  const shotRef = useRef<Shot | null>(null);
  // open() 도중 take()/cancel()이 불리면 늦게 열린 카메라를 바로 끈다
  const generationRef = useRef(0);

  const release = useCallback((shot: Shot) => {
    if (shot.timer) clearInterval(shot.timer);
    shot.timer = null;
    shot.stream.getTracks().forEach(track => track.stop());
    shot.video.srcObject = null;
  }, []);

  const open = useCallback(async (): Promise<FaceCameraResult> => {
    if (shotRef.current) return 'on';
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unsupported';
    const generation = ++generationRef.current;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
      });
    } catch {
      // 거부(NotAllowedError)·카메라 없음(NotFoundError)·다른 앱이 사용 중
      return generation === generationRef.current ? 'denied' : 'cancelled';
    }
    if (generation !== generationRef.current) {
      media.getTracks().forEach(track => track.stop());
      return 'cancelled';
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.srcObject = media;
    await video.play().catch(() => undefined);
    if (generation !== generationRef.current) {
      media.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      return 'cancelled';
    }

    const shot: Shot = { stream: media, video, frames: [], pending: [], timer: null };
    const snap = () => {
      if (shotRef.current !== shot) return;
      if (shot.frames.length + shot.pending.length >= FACE_FRAME_MAX) {
        if (shot.timer) clearInterval(shot.timer);
        shot.timer = null;
        return;
      }
      const task = captureJpeg(video)
        .then(blob => {
          if (blob && shot.frames.length < FACE_FRAME_MAX) shot.frames.push(blob);
        })
        .catch(() => undefined)
        .finally(() => {
          shot.pending = shot.pending.filter(item => item !== task);
        });
      shot.pending.push(task);
    };
    shotRef.current = shot;
    setStream(media);
    snap();
    shot.timer = setInterval(snap, FACE_FRAME_INTERVAL_MS);
    return 'on';
  }, []);

  // 카메라를 끄고 찍은 사진을 넘긴다(찍는 중인 장은 끝날 때까지 기다린다)
  const take = useCallback(async (): Promise<Blob[]> => {
    generationRef.current += 1;
    const shot = shotRef.current;
    shotRef.current = null;
    setStream(null);
    if (!shot) return [];
    if (shot.timer) clearInterval(shot.timer);
    shot.timer = null;
    const pending = [...shot.pending];
    release(shot);
    await Promise.all(pending);
    const frames = shot.frames.slice(0, FACE_FRAME_MAX);
    shot.frames.length = 0;
    return frames;
  }, [release]);

  // 카메라를 끄고 사진은 버린다(녹음 취소·화면 이탈)
  const cancel = useCallback(() => {
    generationRef.current += 1;
    const shot = shotRef.current;
    shotRef.current = null;
    setStream(null);
    if (!shot) return;
    release(shot);
    shot.frames.length = 0;
  }, [release]);

  useEffect(() => cancel, [cancel]);

  return { stream, open, take, cancel };
}
