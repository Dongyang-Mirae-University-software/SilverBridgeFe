'use client';

import { useEffect, useState } from 'react';

import { fetchGuardianAnomalyClipHead } from '@/service/api/guardian/anomaly';
import { createTaskQueue } from './taskQueue';

// 이력 카드 썸네일 = 클립의 첫 화면. 클립 파일은 인증 헤더가 필요해 <video src>에 못 쓰므로, 앞부분(Range)만 받아
// 숨겨진 <video>에서 첫 프레임을 그려 작은 이미지로 쓴다. 영상은 민감 정보라 메모리에만 두고 저장소·캐시에 남기지 않는다.
// 실패(앞부분만으로 못 그림·권한·네트워크)하면 null - 카드는 기존 단색 배경으로 보인다.
const HEAD_BYTES = 256 * 1024;
const THUMBNAIL_WIDTH = 480;
const EXTRACT_TIMEOUT_MS = 8000;

const enqueue = createTaskQueue(3);
const cache = new Map<number, string | null>();
const inflight = new Map<number, Promise<string | null>>();

function extractFirstFrame(blob: Blob): Promise<string | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    let finished = false;

    const finish = (result: string | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), EXTRACT_TIMEOUT_MS);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      try {
        const { videoWidth, videoHeight } = video;
        if (!videoWidth || !videoHeight) return finish(null);
        const scale = Math.min(1, THUMBNAIL_WIDTH / videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(videoWidth * scale);
        canvas.height = Math.round(videoHeight * scale);
        const context = canvas.getContext('2d');
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        finish(null);
      }
    };
    video.src = url;
  });
}

export function loadClipThumbnail(clipId: number): Promise<string | null> {
  if (cache.has(clipId)) return Promise.resolve(cache.get(clipId) ?? null);
  const pending = inflight.get(clipId);
  if (pending) return pending;

  const task = enqueue(async () => {
    try {
      const head = await fetchGuardianAnomalyClipHead(clipId, HEAD_BYTES);
      return await extractFirstFrame(head);
    } catch {
      return null;
    }
  }).then(result => {
    cache.set(clipId, result);
    inflight.delete(clipId);
    return result;
  });
  inflight.set(clipId, task);
  return task;
}

// 카드가 화면에 보일 때만 받는다. attach 는 observer 를 붙일 요소를 받는 콜백 ref 로 쓴다.
export function useClipThumbnail(clipId: number | undefined) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [loaded, setLoaded] = useState(0); // 받기가 끝나면 다시 그리게 하는 신호(값은 캐시에서 읽는다)

  useEffect(() => {
    if (clipId === undefined || !node || cache.has(clipId)) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let cancelled = false;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void loadClipThumbnail(clipId).then(() => {
        if (!cancelled) setLoaded(count => count + 1);
      });
    });
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [clipId, node]);

  const src = clipId === undefined ? null : (cache.get(clipId) ?? null);
  return { src, attach: setNode, loaded };
}
