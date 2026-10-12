// 메인 스레드와 달리 Worker 안의 setInterval은 탭이 숨겨져도 거의 제한받지 않는다.
// postMessage(intervalMs>0): 그 간격으로 틱 전송 시작 (이전 타이머는 교체), postMessage(0): 정지
let timer = null;

self.onmessage = event => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  const intervalMs = event.data;
  if (intervalMs > 0) {
    timer = setInterval(() => self.postMessage(0), intervalMs);
  }
};
