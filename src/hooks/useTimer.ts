'use client';

import { useEffect, useRef, useState } from 'react';

export default function useTimer(initialTime: number) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isExpired, setIsExpired] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    start();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const reset = () => {
    setTimeLeft(initialTime);
    setIsExpired(false);
    start();
  };

  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(
    2,
    '0',
  )}`;

  return {
    timeLeft,
    formattedTime,
    isExpired,
    reset,
  };
}
