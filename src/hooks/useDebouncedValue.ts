import { useEffect, useState } from 'react';

// 입력값이 delay 동안 바뀌지 않으면 그 값을 돌려준다 - 검색 요청을 글자마다 보내지 않기 위해
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
