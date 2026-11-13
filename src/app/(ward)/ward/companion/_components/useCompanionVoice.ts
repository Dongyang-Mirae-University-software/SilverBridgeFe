'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { speak, stopSpeaking } from '@/lib/audio/speech';
import { fetchWardCompanionAudio } from '@/service/api/ward/companion';

// 말벗 목소리 재생 - 서버가 만든 소리가 있으면 받아서 틀고, 없거나 못 받으면 기기 음성(speak)으로 대신 읽는다.
// 받은 소리(Blob)는 이 화면 메모리에만 둔다(다시 듣기용). 브라우저 캐시·localStorage에 남기지 않는다.

// 요청 뒤 이 시간 안에 못 받으면 대신 읽는다. 그 뒤에 온 소리는 버린다(두 번 읽지 않게)
export const COMPANION_AUDIO_WAIT_MS = 8_000;

// 샘플 0개짜리 WAV - "대화 시작"을 누른 그 순간 한 번 틀어 두면 iOS Safari가 이 <audio>를 나중에도 틀게 해 준다
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export type VoiceLine = {
  id: number;
  text: string;
  audio?: { sessionId: number; index: number } | null;
};

export function useCompanionVoice() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 문장마다 1씩 오른다 - 늦게 끝난 받기·재생 결과가 지금 문장이 아니면 버린다
  const turnRef = useRef(0);
  const blobsRef = useRef(new Map<number, Blob>());
  // 지금 목소리를 받는 중인 문장 - 그 문장의 다시 듣기는 받기를 끊지 않는다(점검 L-3)
  const fetchingLineRef = useRef<number | null>(null);
  const [audioLineIds, setAudioLineIds] = useState<ReadonlySet<number>>(() => new Set());
  const [blockedLineId, setBlockedLineId] = useState<number | null>(null);

  const element = () => {
    if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();
    return audioRef.current;
  };

  const releaseUrl = () => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.onended = null;
      el.removeAttribute('src');
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  // 지금 소리·받는 중인 소리·기기 음성을 모두 멈춘다. 받던 소리가 나중에 와도 틀지 않는다
  const stop = useCallback(() => {
    turnRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    fetchingLineRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    releaseUrl();
    stopSpeaking();
    setBlockedLineId(null);
  }, []);

  const playBlob = useCallback((line: VoiceLine, blob: Blob, turn: number) => {
    const el = element();
    if (!el) {
      speak(line.text);
      return;
    }
    releaseUrl();
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    el.src = url;
    el.onended = () => {
      if (turnRef.current === turn) releaseUrl();
    };
    let played: Promise<void> | undefined;
    try {
      played = el.play();
    } catch (error) {
      played = Promise.reject(error);
    }
    void Promise.resolve(played).catch((error: unknown) => {
      if (turnRef.current !== turn) return;
      // 화면을 누르기 전이라 브라우저가 막았다 - "들려 주세요"를 누르면 그 동작으로 다시 튼다
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setBlockedLineId(line.id);
        return;
      }
      releaseUrl();
      speak(line.text);
    });
  }, []);

  // 새 문장 - 앞 소리를 멈추고, 목소리가 있으면 받아서 틀고 없으면 대신 읽는다
  const play = useCallback((line: VoiceLine) => {
    stop();
    const turn = turnRef.current;
    const audio = line.audio;
    if (!audio) {
      speak(line.text);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    fetchingLineRef.current = line.id;
    let settled = false;
    const fallback = () => {
      if (settled || turnRef.current !== turn) return;
      settled = true;
      abortRef.current = null;
      fetchingLineRef.current = null;
      speak(line.text);
    };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fallback();
      controller.abort();
    }, COMPANION_AUDIO_WAIT_MS);
    fetchWardCompanionAudio(audio.sessionId, audio.index, controller.signal).then(
      blob => {
        if (settled || turnRef.current !== turn) return;
        settled = true;
        abortRef.current = null;
        fetchingLineRef.current = null;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        blobsRef.current.set(line.id, blob);
        setAudioLineIds(current => new Set(current).add(line.id));
        playBlob(line, blob, turn);
      },
      () => {
        // 404·503·네트워크 오류·시간 초과(abort) - 지금 문장이면 한 번만 대신 읽는다
        if (turnRef.current === turn && timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        fallback();
      },
    );
  }, [stop, playBlob]);

  // 다시 듣기·"들려 주세요" - 받아 둔 소리를 다시 틀고, 없으면 대신 읽는다(다시 받지 않는다)
  // 받는 중인 문장이면 아무것도 하지 않는다 - 끊으면 그 문장은 서버 목소리를 영영 못 듣는다(받기는 최대 8초 안에 끝난다)
  const replay = useCallback((line: VoiceLine) => {
    if (fetchingLineRef.current === line.id) return;
    stop();
    const blob = blobsRef.current.get(line.id);
    if (blob) playBlob(line, blob, turnRef.current);
    else speak(line.text);
  }, [stop, playBlob]);

  // 사용자가 누른 그 순간(대화 시작) 부른다 - 소리 낼 권한을 미리 얻어 둔다
  const prime = useCallback(() => {
    const el = element();
    if (!el || urlRef.current) return;
    el.src = SILENT_WAV;
    try {
      void Promise.resolve(el.play()).catch(() => undefined);
    } catch {
      // 무음 재생 실패는 무시 - 막히면 "들려 주세요"로 받는다
    }
  }, []);

  // 대화를 닫으면 받아 둔 소리도 버린다
  const reset = useCallback(() => {
    stop();
    blobsRef.current.clear();
    setAudioLineIds(new Set());
  }, [stop]);

  // 화면을 떠나면 멈추고 해제한다
  useEffect(() => () => {
    turnRef.current += 1;
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    releaseUrl();
    stopSpeaking();
    blobsRef.current.clear();
    audioRef.current = null;
  }, []);

  return useMemo(
    () => ({ play, replay, stop, prime, reset, blockedLineId, hasAudio: (id: number) => audioLineIds.has(id) }),
    [play, replay, stop, prime, reset, blockedLineId, audioLineIds],
  );
}
