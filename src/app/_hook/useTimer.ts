'use client';

import { useEffect, useState } from 'react';

export default function useTimer(initialTime: number) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []); // 🔥 의존성 제거

  const reset = () => {
    setTimeLeft(initialTime);
    setIsExpired(false);
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
