'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 남은 시간은 "마감 시각 - 지금"으로 계산한다(2026-11-24).
// 1초마다 1씩 깎던 방식은 인증번호를 보러 문자 앱으로 간 사이 휴대폰 브라우저가 타이머를 멈추거나 늦춰,
// 화면에는 시간이 남아 확인 버튼이 켜져 있는데 서버의 인증번호(5분)는 이미 만료되는 일이 있었다.
function secondsUntil(deadline: number) {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

export default function useTimer(initialTime: number) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  const deadlineRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const left = secondsUntil(deadlineRef.current);
    setTimeLeft(left);
    if (left === 0) stop();
  }, [stop]);

  const start = useCallback(() => {
    stop();
    deadlineRef.current = Date.now() + initialTime * 1000;
    timerRef.current = setInterval(tick, 1000);
  }, [initialTime, stop, tick]);

  useEffect(() => {
    start();

    // 다른 앱·탭에서 돌아오는 순간 바로 실제 남은 시간으로 맞춘다(멈춰 있던 동안의 시간을 반영)
    const syncOnReturn = () => {
      if (document.visibilityState === 'visible' && deadlineRef.current > 0) tick();
    };
    document.addEventListener('visibilitychange', syncOnReturn);
    window.addEventListener('focus', syncOnReturn);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', syncOnReturn);
      window.removeEventListener('focus', syncOnReturn);
    };
  }, [start, stop, tick]);

  const reset = () => {
    setTimeLeft(initialTime);
    start();
  };

  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(
    2,
    '0',
  )}`;

  return {
    timeLeft,
    formattedTime,
    isExpired: timeLeft === 0,
    reset,
  };
}
