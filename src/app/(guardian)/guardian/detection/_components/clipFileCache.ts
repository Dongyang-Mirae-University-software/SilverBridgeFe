'use client';

import { fetchGuardianAnomalyClipFile } from '@/service/api/guardian/anomaly';
import { SESSION_CLEARED_EVENT } from '@/lib/auth/tokenStore';

// 받은 클립 파일을 이 탭 메모리에만 잠깐 둔다 - 같은 영상을 다시 열거나 장면을 오가도 다시 받지 않게(회선이 느려 한 번에 5~15초).
// 저장소·HTTP 캐시에는 남기지 않는다(집 안 영상). 최근 MAX_CLIPS 개만 두고, 로그아웃(세션 정리)하면 모두 비운다.
const MAX_CLIPS = 6;

type ProgressListener = (receivedBytes: number) => void;

interface Download {
  promise: Promise<Blob>;
  received: number;
  listeners: Set<ProgressListener>;
}

const blobs = new Map<number, Blob>();
const downloads = new Map<number, Download>();
const idleWaiters = new Set<() => void>();

function remember(clipId: number, blob: Blob) {
  blobs.delete(clipId);
  blobs.set(clipId, blob);
  while (blobs.size > MAX_CLIPS) {
    const oldest = blobs.keys().next().value;
    if (oldest === undefined) break;
    blobs.delete(oldest);
  }
}

function notifyIdle() {
  if (downloads.size > 0) return;
  idleWaiters.forEach(resolve => resolve());
  idleWaiters.clear();
}

export function getCachedClipFile(clipId: number): Blob | undefined {
  const blob = blobs.get(clipId);
  if (blob) remember(clipId, blob);
  return blob;
}

// 로그아웃(세션 정리) 때 비우는 구독은 처음 받을 때 한 번만 건다
let listeningSessionClear = false;
function listenSessionClear() {
  if (listeningSessionClear || typeof window === 'undefined') return;
  listeningSessionClear = true;
  window.addEventListener(SESSION_CLEARED_EVENT, clearClipFileCache);
}

// 같은 클립을 동시에 여러 번 요청해도 한 번만 받는다. onProgress 는 받은 바이트 수(이미 받은 것도 바로 한 번 알린다)
export function loadClipFile(clipId: number, onProgress?: ProgressListener): Promise<Blob> {
  listenSessionClear();
  const cached = getCachedClipFile(clipId);
  if (cached) return Promise.resolve(cached);

  const existing = downloads.get(clipId);
  if (existing) {
    if (onProgress) {
      existing.listeners.add(onProgress);
      onProgress(existing.received);
    }
    return existing.promise;
  }

  const listeners = new Set<ProgressListener>(onProgress ? [onProgress] : []);
  const download: Download = { promise: Promise.resolve(new Blob()), received: 0, listeners };
  download.promise = fetchGuardianAnomalyClipFile(clipId, received => {
    download.received = received;
    download.listeners.forEach(listener => listener(received));
  })
    .then(blob => {
      if (downloads.get(clipId) === download) remember(clipId, blob);
      return blob;
    })
    .finally(() => {
      if (downloads.get(clipId) === download) downloads.delete(clipId);
      notifyIdle();
    });
  downloads.set(clipId, download);
  return download.promise;
}

export function stopClipProgress(clipId: number, onProgress: ProgressListener) {
  downloads.get(clipId)?.listeners.delete(onProgress);
}

// 숨겨진(오탐 판정) 영상은 메모리에서도 내린다
export function forgetClipFile(clipId: number) {
  blobs.delete(clipId);
}

// 영상 파일을 받는 동안에는 썸네일이 느린 회선을 나눠 쓰지 않게 기다린다
export function waitForClipDownloadsIdle(): Promise<void> {
  if (downloads.size === 0) return Promise.resolve();
  return new Promise(resolve => idleWaiters.add(resolve));
}

export function clearClipFileCache() {
  blobs.clear();
  downloads.clear();
  notifyIdle();
}
